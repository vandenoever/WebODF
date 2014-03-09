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

/*global odf, window, core, NodeFilter*/
/**
 * @constructor
 */
odf.TextLayout = function TextLayout() {
    "use strict";
    var domUtils = new core.DomUtils(),
        officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
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
    /**
     * @param {!odf.ODFDocumentElement} odfRoot
     * @return {?Element}
     */
    function getOfficeText(odfRoot) {
        return domUtils.getDirectChild(odfRoot.body, officens, "text");
    }
    /**
     * @param {!Node} node
     * @return {!number}
     */
    function paragraphNodeFilter(node) {
        var r = NodeFilter.FILTER_ACCEPT;
        if (node.localName !== "p" && node.localName !== "h") {
            r = NodeFilter.FILTER_REJECT;
        } else if (node.namespaceURI !== textns) {
            r = NodeFilter.FILTER_REJECT;
        }
        return r;
    }
    /**
     * @param {!Element} officeText
     * @return {!TreeWalker}
     */
    function createParagraphWalker(officeText) {
        var doc = officeText.ownerDocument;
        return doc.createTreeWalker(officeText, NodeFilter.SHOW_ELEMENT,
            paragraphNodeFilter, false);
    }
    /**
     * @param {!Element} element
     * @return {!number}
     */
    function getTop(element) {
        var he = /**@type{!HTMLElement}*/(element),
            top = he.offsetTop || 0;
        if (he.offsetParent) {
            top += getTop(he.offsetParent);
        }
        return top;
    }
    /**
     * @param {!Element} element
     * @return {!number}
     */
    function getBottom(element) {
        var height = /**@type{!HTMLElement}*/(element).offsetHeight || 0;
        return height + getTop(element);
    }
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @return {!HTMLDivElement}
     */
    function createPageDiv(pagesDiv) {
        var doc = pagesDiv.ownerDocument,
            htmlns = pagesDiv.namespaceURI,
            page = doc.createElementNS(htmlns, "div"),
            header = doc.createElementNS(htmlns, "div"),
            footer = doc.createElementNS(htmlns, "div");
        page.style.cssFloat = "right";
        page.style.width = "1px";
        page.style.height = "10cm";
        page.style.position = "relative";

        header.style.position = "absolute";
        header.style.right = 0;
        header.style.top = 0;
        header.style.width = "1cm";
        header.style.height = "1cm";
        header.style.background = "yellow";

        footer.style.position = "absolute";
        footer.style.right = 0;
        footer.style.bottom = 0;
        footer.style.width = "1cm";
        footer.style.height = "1cm";
        footer.style.background = "red";

        page.appendChild(header);
        page.appendChild(footer);
        return /**@type{!HTMLDivElement}*/(page);
    }
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @return {!HTMLDivElement}
     */
    function createSeparator(pagesDiv) {
        var doc = pagesDiv.ownerDocument,
            htmlns = pagesDiv.namespaceURI,
            separator = doc.createElementNS(htmlns, "div");
        separator.style.cssFloat = "right";
        separator.style.width = "100%";
        separator.style.height = "1cm";
        separator.style.background = "black";
        return /**@type{!HTMLDivElement}*/(separator);
    }
    /**
     * @param {!number} page
     * @param {!HTMLDivElement} pagesDiv
     * @return {!HTMLDivElement}
     */
    function getPageDiv(page, pagesDiv) {
        var pageDiv = pagesDiv.firstElementChild;
        if (pageDiv === null) {
            pagesDiv.appendChild(createSeparator(pagesDiv));
        }
        while (page > 0 && pageDiv !== null) {
            pageDiv = pageDiv.nextElementSibling;
            pageDiv = pageDiv && pageDiv.nextElementSibling;
            if (pageDiv !== null) {
                page -= 1;
            }
        }
        if (pageDiv === null) {
            while (page > 0) {
                pageDiv = pagesDiv.appendChild(createPageDiv(pagesDiv));
                pagesDiv.appendChild(createSeparator(pagesDiv));
                page -= 1;
            }
        }
        return /**@type{!HTMLDivElement}*/(pageDiv);
    }
    /**
     * @param {!number} pageBottom
     * @param {?Element} officeText
     * @param {?Element} previousFirstPageParagraph
     * @return {?Element}
     */
    function getFirstPageParagraph(pageBottom, officeText, previousFirstPageParagraph) {
        if (!officeText) {
            return null;
        }
        var walker = createParagraphWalker(officeText),
            top,
            e;
        if (previousFirstPageParagraph) {
            walker.currentNode = previousFirstPageParagraph;
        }
        e = /**@type{?Element}*/(walker.nextNode());
        while (e) {
            top = getTop(e);
            if (top >= pageBottom) {
                break;
            }
            e = /**@type{?Element}*/(walker.nextNode());
        }
        return e;
    }
    /**
     * @param {!Element} masterPageStyle
     * @return {!odf.TextLayout.PageDimensions}
     */
    function getPageDimensions(masterPageStyle) {
        var dims = {
                pageHeight: 1130, // ~ 30 cm
                marginTop: 60,
                marginBottom: 60,
                pageSeparation: 30,// ~ 1 cm
                background: "black"
            };
        if (masterPageStyle) {
            dims.background = "black";
        }
        return dims;
    }
    /**
     * @param {!HTMLDivElement} pageDiv
     * @param {!Element} masterPageStyle
     * @return {undefined}
     */
    function updatePageSize(pageDiv, masterPageStyle) {
        var dim = getPageDimensions(masterPageStyle),
            h = dim.pageHeight + "px";
        if (pageDiv.style.height !== h) {
            pageDiv.style.height = h;
        }
    }
    /**
     * @param {!number} currentPage
     * @param {!Element} paragraph
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {!Element}
     */
    function getMasterPageStyle(currentPage, paragraph, odfroot) {
        var p = paragraph;
        if (currentPage || odfroot) {
            p = paragraph;
        }
        return p;
    }
    /**
     * Update the layout of pages.
     * Returns the number of the next page that should be layed out or 0 if
     * layout is done.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @param {!number} currentPage
     * @return {!number}
     */
    function updateLayout(odfroot, pagesDiv, maxTime, currentPage) {
        currentPage = Math.max(1, currentPage);
        var officeText = getOfficeText(odfroot),
            masterPageStyle,
            firstPageParagraph = getFirstPageParagraph(0, officeText, null),
            end = endTime(maxTime),
            pageBottom,
            pageDiv,
            timeLeft = true;
runtime.log(currentPage + " " + firstPageParagraph);
runtime.log(firstPageParagraph + " ");
        while (timeLeft && firstPageParagraph) {
            masterPageStyle = getMasterPageStyle(currentPage,
                    firstPageParagraph, odfroot);
            pageDiv = getPageDiv(currentPage, pagesDiv);
console.log(pageDiv);
            updatePageSize(pageDiv, masterPageStyle);
            currentPage += 1;
            pageBottom = getBottom(pageDiv);
            firstPageParagraph = getFirstPageParagraph(pageBottom, officeText, firstPageParagraph);
            timeLeft = checkTime(end);
runtime.log("timeleft " + timeLeft);
runtime.log(firstPageParagraph + " ");
        }
        return timeLeft ? 0 : currentPage;
    }
    this.updateLayout = updateLayout;
    /**
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @return {undefined}
     */
    function updateCompleteLayout(odfroot, pagesDiv) {
        var page = 1,
            count = 0;
        do {
            page = updateLayout(odfroot, pagesDiv, 1, page);
            count += 1;
        } while (page !== 0 && count < 10);
    }
    this.updateCompleteLayout = updateCompleteLayout;
};
/**@typedef{{
    pageHeight:!number,
    marginTop:!number,
    marginBottom:!number,
    pageSeparation:!number,
    background:!string
}}*/
odf.TextLayout.PageDimensions;
