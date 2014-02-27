/**
 * @license
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global odf, window*/
/**
 * @constructor
 */
odf.TextLayout = function TextLayout() {
    "use strict";
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @return {!number}
     */
    function countPages(pagesDiv) {
        return Math.ceil((pagesDiv.childElementCount - 1) / 2);
    }
    /**
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @return {!number}
     */
    function getPagesHeight(dims, pagesDiv) {
        var npages = countPages(pagesDiv),
            height;
        height = npages * dims.pageHeight + (npages - 1) * dims.pageSeparation;
        return height;
    }
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} count
     * @return {undefined}
     */
    function removePages(pagesDiv, count) {
        var last = pagesDiv.lastElementChild;
        while (count > 0) {
            pagesDiv.removeChild(last);
            last = pagesDiv.lastElementChild;
            if (last) {
                pagesDiv.removeChild(last);
                last = pagesDiv.lastElementChild;
            }
            count -= 1;
        }
        last.style.marginBottom = 0;
        last.style.height = 0;
    }
    /**
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} count
     * @return {undefined}
     */
    function addPages(dims, pagesDiv, count) {
        var doc = pagesDiv.ownerDocument,
            frag = doc.createDocumentFragment(),
            htmlns = doc.documentElement.namespaceURI,
            n = countPages(pagesDiv),
            lastSeparator = pagesDiv.lastElementChild,
            contentHeight = dims.pageHeight - dims.marginTop - dims.marginBottom,
            div;
        count += n;
        while (n < count) {
            // make separator
            div = doc.createElementNS(htmlns, "div");
            div.style.width = "100%";
            div.style.cssFloat = "right";
            div.style.position = "relative";
            div.style.zIndex = 10;
            div.style.marginBottom = dims.marginTop + "px";
            if (n > 0) {
                div.style.height = dims.pageSeparation + "px";
                div.style.marginTop = dims.marginBottom + "px";
                div.style.background = dims.background;
            }
            frag.appendChild(div);
            div = doc.createElementNS(htmlns, "div");
            div.style.height = contentHeight + "px";
            div.style.width = "1px";
            div.style.cssFloat = "right";
            frag.appendChild(div);
            n += 1;
        }
        div = doc.createElementNS(htmlns, "div");
        div.style.width = "100%";
        div.style.cssFloat = "right";
        div.style.position = "relative";
        div.style.zIndex = 10;
        div.style.marginTop = dims.marginBottom + "px";
        frag.appendChild(div);
        if (lastSeparator) {
            pagesDiv.replaceChild(frag, lastSeparator);
        } else {
            pagesDiv.appendChild(frag);
        }
    }
    /**
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} bodyHeight
     * @return {!boolean}
     */
    function adjustPages(dims, pagesDiv, bodyHeight) {
        var missingHeight = bodyHeight - getPagesHeight(dims, pagesDiv),
            missingPages = Math.ceil(missingHeight / dims.pageHeight),
            pageCountChanged = false;
        if (missingPages > 0) {
            // too few pages
            pageCountChanged = true;
            addPages(dims, pagesDiv, missingPages);
        } else if (missingPages < 0) {
            // too many pages
            pageCountChanged = true;
            removePages(pagesDiv, -missingPages);
        }
        return pageCountChanged;
    }
    /**
     * @param {!number} maxTime
     * @return {!number}
     */
    function endTime(maxTime) {
        return new Date().getTime() + maxTime;
    }
    /**
     * @param {!number} end
     * @return {!boolean}
     */
    function checkTime(end) {
        var now = new Date().getTime();
        return now < end;
    }
    /**
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @return {!boolean}
     */
    function updateNumberOfPages(odfroot, dims, pagesDiv, maxTime) {
        var text = odfroot.body.lastElementChild,
            end = endTime(maxTime),
            textHeight = text.clientHeight,
            timeLeft = true;
        while (timeLeft && adjustPages(dims, pagesDiv, textHeight)) {
            timeLeft = checkTime(end);
        }
        return timeLeft;
    }
    /**
     * Layout the text by resizing frames and updating the numbers of pages.
     * This function runs for the maximum allocated time and returns true if
     * it is done in that time.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @param {!odf.TextLayout.PageDimensions=} dims
     * @return {!boolean}
     */
    function layout(odfroot, pagesDiv, maxTime, dims) {
        if (!dims) {
            dims = {
                pageHeight: 1130, // ~ 30 cm
                marginTop: 60,
                marginBottom: 60,
                pageSeparation: 30,// ~ 1 cm
                background: "black"
            };
        }
        updateNumberOfPages(odfroot, dims, pagesDiv, maxTime);
        updateNumberOfPages(odfroot, dims, pagesDiv, maxTime);
        return maxTime > 0;
    }
    this.layout = layout;
};
/**@typedef{{
    pageHeight:!number,
    marginTop:!number,
    marginBottom:!number,
    pageSeparation:!number,
    background:!string
}}*/
odf.TextLayout.PageDimensions;
