/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
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
 * @source: http://gitorious.org/webodf/webodf/
 */

/*global runtime, core, xmled, xmldom, XSLTProcessor, XMLHttpRequest, NodeFilter, document */

runtime.loadClass("xmled.XmlCanvas");
runtime.loadClass("xmled.CrumbBar");
runtime.loadClass("xmled.AttributeEditor");
runtime.loadClass("xmldom.LSSerializer");

/**
 * @constructor
 * @param {!Element} element element to put the editor in
 * @param {string} grammarurl
 * @param {string} styleurl
 **/
xmled.XmlEditor = function XmlEditor(element, grammarurl, styleurl) {
    "use strict";
    /**
     * @constructor
     * @extends NodeFilter
     * @param {string} ns
     */
    function Filter(ns) {
        /**
         * @param {!Node} node
         * @return {number}
         */
        this.acceptNode = function (node) {
            if (node.namespaceURI === ns) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        };
    }
    var doc = element.ownerDocument,
        htmlns = element.namespaceURI,
        cursorns = "urn:webodf:names:cursor",
        filter = new Filter(cursorns),
        /**@type{!HTMLDivElement}*/
        canvasElement = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns, "div")),
        crumbElement = doc.createElementNS(htmlns, "div"),
        attributeEditorElement = doc.createElementNS(htmlns, "div"),
        contextInfoElement = doc.createElementNS(htmlns, "div"),
        validationModel = new xmled.ValidationModel(grammarurl),
        attributeEditor = new xmled.AttributeEditor(attributeEditorElement),
        /**@type{!xmled.XmlCanvas}*/
        canvas,
        /**@type{xmled.CrumbBar}*/
        crumbBar = null,
        /**@type{!HTMLDivElement}*/
        viewButtons,
        xmlSerializer = new xmldom.LSSerializer(),
        editdiv = doc.createElementNS(htmlns, "div"),
        xmldiv = doc.createElementNS(htmlns, "div"),
        pdfframe = doc.createElementNS(htmlns, "iframe"),
        /**@type{!HTMLIFrameElement}*/
        htmlframe = /**@type{!HTMLIFrameElement}*/(doc.createElementNS(htmlns, "iframe")),
        /**@type{!XSLTProcessor}*/
        htmlXslt,
        /**@type{!XSLTProcessor}*/
        xslfoXslt,
        /**@type{number}*/
        pdfcount = 0;
    function fixSize() {
        var height = element.parentElement.clientHeight
                     - viewButtons.clientHeight - 10;
        xmldiv.height = height;
        xmldiv.width = "98%";
        pdfframe.height = height;
        pdfframe.width = "98%";
        htmlframe.height = height + "px";
        htmlframe.width = "98%";
        height -= crumbElement.clientHeight;
        height += "px";
        canvasElement.style.height = height;
        contextInfoElement.style.height = height;
        attributeEditorElement.style.height = height;
    }
    function loadXSLTs() {
        htmlXslt = new XSLTProcessor();
        runtime.loadXML("xsd/opxml2html.xsl", function (err, dom) {
            if (err) {
                runtime.log(err);
            } else {
                runtime.log("loading xslt " + dom.documentElement.localName);
                htmlXslt.importStylesheet(dom);
            }
        });
        xslfoXslt = new XSLTProcessor();
        runtime.loadXML("xsd/opxml2xslfo.xsl", function (err, dom) {
            if (err) {
                runtime.log(err);
            } else {
                runtime.log("loading xslt " + dom.documentElement.localName);
                xslfoXslt.importStylesheet(dom);
            }
        });
    }
    /**
     * @param {!Element} element
     */
    function show(element) {
        editdiv.style.display = (element === editdiv) ? "block" : "none";
        xmldiv.style.display = (element === xmldiv) ? "block" : "none";
        htmlframe.style.display = (element === htmlframe) ? "block" : "none";
        pdfframe.style.display = (element === pdfframe) ? "block" : "none";
    }
    /**
     * @return {!Element}
     */
    function cleanNode() {
        var xml = xmlSerializer.writeToString(canvas.getDocumentRoot(), {});
        return runtime.parseXML(xml).documentElement;
    }
    /**
     * @param {!Element} src
     * @param {!Element} tgt
     */
    function addAttributes(src, tgt) {
        var as = src.attributes,
            l = as.length,
            i,
            a,
            an,
            av;
        for (i = 0; i < l; i += 1) {
            a = as.item(i);
            if (a.namespaceURI !== cursorns) {
                an = doc.createElementNS(cursorns, "an");
                av = doc.createElementNS(cursorns, "av");
                an.textContent = a.localName;
                av.textContent = a.nodeValue;
                tgt.appendChild(an);
                tgt.appendChild(av);
            }
        }
    }
    /**
     * @param {!Element} src
     * @param {!Element} tgt
     */
    function createXmlView(src, tgt) {
        if (src.namespaceURI === cursorns) {
            return;
        }
        var e,
            before,
            tag,
            after,
            srcnode;
        if (src.prefix) {
            tag = src.prefix + ':' + src.localName;
        } else {
            tag = src.localName;
        }
        e = doc.createElementNS(cursorns, "e");
        if (src.firstChild) {
            before = doc.createElementNS(cursorns, "o");
            after = doc.createElementNS(cursorns, "c");
            after.appendChild(doc.createTextNode(tag));
        } else {
            before = doc.createElementNS(cursorns, "t");
        }
        before.appendChild(doc.createTextNode(tag));
        addAttributes(src, before);
        e.appendChild(before);
        srcnode = src.firstChild;
        while (srcnode) {
            if (srcnode.nodeType === 1) {
                createXmlView(/**@type{!Element}*/(srcnode), e);
            } else {
                e.appendChild(srcnode.cloneNode(false));
            }
            srcnode = srcnode.nextSibling;
        }
        if (after) {
            e.appendChild(after);
        }
        tgt.appendChild(e);
    }
    /**
     * @param {!Element} element
     * @return {!Object.<string,boolean>}
     */
    function getClasses(element) {
        var classes = element.getAttribute("class"),
            c = {},
            i;
        if (classes) {
            classes = classes.split(" ");
            for (i = 0; i < classes.length; i += 1) {
                c[classes[i]] = true;
            }
        }
        return c;
    }
/*
    function addClass(element, value) {
        var classes = getClasses(element);
        classes[value] = 1;
        element.setAttribute("class", Object.keys(classes).join(" "));
    }
    function removeClass(element, value) {
        var classes = getClasses(element);
        delete classes[value];
        element.setAttribute("class", Object.keys(classes).join(" "));
    }
*/
    /**
     * @param {!Element} element
     * @param {!Array.<string>} toAdd
     * @param {!Array.<string>} toRemove
     */
    function changeClasses(element, toAdd, toRemove) {
        var classes = getClasses(element);
        toAdd.forEach(function (v) {
            classes[v] = true;
        });
        toRemove.forEach(function (v) {
            delete classes[v];
        });
        element.setAttribute("class", Object.keys(classes).join(" "));
    }
    function toxml() {
        show(xmldiv);
        var n = xmldiv;
        while (n.firstChild) {
            n.removeChild(n.firstChild);
        }
        createXmlView(canvas.getDocumentRoot(), xmldiv);
        xmldiv.style.background = 'white';
//        addNameAttributes(canvas.getDocumentRoot());
    }
/*
        show(xmlframe);
        var node = cleanNode(),
            c;
        c = xmlframe.contentDocument.importNode(node, true);
        xmlframe.contentDocument.replaceChild(c, xmlframe.contentDocument.documentElement);
*/
    function toedit() {
        show(editdiv);
    }
    function tohtml() {
        var html, frame;
        frame = /**@type{!HTMLIFrameElement}*/(doc.createElementNS(htmlns, "iframe"));
        htmlframe.parentNode.replaceChild(frame, htmlframe);
        htmlframe = frame;
        fixSize();
        show(htmlframe);
        try {
            html = htmlXslt.transformToDocument(cleanNode());
        } catch (/**@type{!DOMError}*/e) {
            runtime.log(e.message);
            return;
        }
        html = htmlframe.contentDocument.importNode(html.documentElement, true);
        htmlframe.contentDocument.replaceChild(html, htmlframe.contentDocument.documentElement);
        runtime.log("transforming to html");
    }
    function topdf() {
        show(pdfframe);
        var xslfo, xhr = new XMLHttpRequest();
        try {
            xslfo = xslfoXslt.transformToDocument(cleanNode());
        } catch (/**@type{!DOMError}*/e) {
            runtime.log(e.message);
            return;
        }
        
        runtime.log("transforming to pdf");
        function handleResult() {
            if (xhr.readyState === 4) {
                if (xhr.status === 0 && !xhr.responseText) {
                    runtime.log(xhr.responseText || xhr.statusText);
                } else if (xhr.status === 200 || xhr.status === 0) {
                    runtime.log(xhr.responseText || xhr.statusText);
                } else {
                    runtime.log(xhr.responseText || xhr.statusText);
                }
                pdfframe.setAttribute("src", "Viewer.js/?" + pdfcount + "#../out.pdf?" + pdfcount + ".pdf");
                pdfcount += 1;
            }
        }
        xhr.open('POST', 'in.fo', true);
        xhr.onreadystatechange = handleResult;
        xhr.setRequestHeader("Content-Type", "text/xml");
        try {
            xhr.send(xslfo);
        } catch (/**@type{string}*/ex) {
            runtime.log(ex);
        }
    }
    /**
     * @param {string} text
     * @param {function()} onclick
     */
    function createViewButton(text, onclick) {
        var button = doc.createElementNS(htmlns, "span");
        button.appendChild(doc.createTextNode(text));
        button.style.margin = "3px";
        button.style.cursor = "pointer";
        button.style.fontFamily = "sans";
        button.onclick = onclick;
        viewButtons.appendChild(button);
        return button;
    }
    function createViewButtons() {
        viewButtons = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns, "div"));
        createViewButton("edit", toedit);
        createViewButton("xml", toxml);
        createViewButton("html", tohtml);
        createViewButton("pdf", topdf);
    }
    /**
     * @constructor
     * @implements {xmldom.LSSerializerFilter}
     */
    function LSFilter() {
        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var result;
            if (node.namespaceURI && node.namespaceURI.match(/^urn:webodf:/)) {
                // skip all webodf nodes incl. child nodes
                result = NodeFilter.FILTER_REJECT;
            } else {
                result = NodeFilter.FILTER_ACCEPT;
            }
            return result;
        };
    }
    /**
     * @param {!Event} event
     * @return {undefined}
     */
    function cancelEvent(event) {
        if (event.preventDefault) {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }
    }
    /**
     * @return {!boolean}
     */
    function initCrumbBar() {
        if (crumbBar) {
            return true;
        }
        var root = canvas.getDocumentRoot();
        if (root) {
            crumbBar = new xmled.CrumbBar(crumbElement, root, validationModel, filter);
            // validate just to test the validation code
            validationModel.validate(root);
        }
        return crumbBar !== null;
    }
    /**
     * @param {!Element} element
     */
    function setActiveElement(element) {
        if (initCrumbBar()) {
            crumbBar.setElement(element);
        }
        var root = canvas.getDocumentRoot(),
            info = validationModel.getElementInfo(root, element, filter),
            defs = validationModel.getAttributeDefinitions(root, element, filter),
            y;
        contextInfoElement.innerHTML = info;
        attributeEditor.setAttributeDefinitions(defs, element);
        canvas.getCaret().handleClick(element);
        y = /**@type{HTMLElement}*/(element).offsetTop
                - canvasElement.scrollTop - canvasElement.offsetTop;
        if (y < 0 || y + element.clientHeight > canvasElement.clientHeight) {
            element.scrollIntoView(true);
        }
    }

    /**
     * @return {undefined}
     */
    function init() {
        xmlSerializer.filter = new LSFilter();

        loadXSLTs();

        createViewButtons();
        element.appendChild(viewButtons);
        element.appendChild(editdiv);
        element.appendChild(xmldiv);
        element.appendChild(pdfframe);
        element.appendChild(htmlframe);
        editdiv.appendChild(crumbElement);
        editdiv.appendChild(contextInfoElement);
        editdiv.appendChild(canvasElement);
        editdiv.appendChild(attributeEditorElement);
        changeClasses(canvasElement, ["canvas"], ["xmlcanvas"]);
        toedit();

        editdiv.style.verticalAlign = 'top';
        editdiv.style.width = "100%";
        editdiv.style.whiteSpace = 'nowrap';
        crumbElement.style.height = "auto";
        crumbElement.style.paddingBottom = "0.1em";
        crumbElement.style.backgroundColor = '#000000';
        crumbElement.style.whiteSpace = 'normal';
        crumbElement.className = 'unselectable';
        canvasElement.style.marginTop = "0.3em";
        canvasElement.style.display = "inline-block";
        canvasElement.style.width = "40em";
        canvasElement.style.overflow = "auto";
        canvasElement.style.whiteSpace = 'normal';
        canvasElement.setAttribute('id', 'xmlcanvas');
        canvasElement.style.boxShadow = '0px 0px 20px #aaa';
        canvasElement.style.background = 'white';
        canvasElement.setAttribute("tabindex", "1");
        contextInfoElement.style.marginTop = "0.3em";
        contextInfoElement.style.display = "inline-block";
        contextInfoElement.style.width = "12em";
        contextInfoElement.style.verticalAlign = 'top';
        contextInfoElement.style.padding = '0.2em';
        contextInfoElement.style.whiteSpace = 'normal';
        contextInfoElement.style.fontFamily = 'sans';
        contextInfoElement.style.fontSize = 'smaller';
        attributeEditorElement.style.fontSize = 'smaller';
        attributeEditorElement.style.display = "inline-block";
        attributeEditorElement.style.marginTop = "0.3em";
        attributeEditorElement.style.verticalAlign = 'top';
        attributeEditorElement.style.padding = '0.2em';
        attributeEditorElement.style.overflow = "auto";
        attributeEditorElement.style.whiteSpace = 'normal';
        attributeEditorElement.style.fontFamily = 'sans';
        attributeEditorElement.style.fontSize = 'smaller';
        attributeEditorElement.className = 'unselectable';
        viewButtons.className = 'unselectable';
        canvas = new xmled.XmlCanvas(canvasElement, validationModel, styleurl);
        initCrumbBar();

        /**
         * @param {Event} evt
         */
        canvasElement.onmouseup = function (evt) {
            var target = /**@type{!Element}*/(evt.target);
            while (target.namespaceURI === cursorns
                    || target.parentElement.namespaceURI === cursorns) {
                target = target.parentElement;
            }
            if (!canvas.getDocumentRoot().contains(target)) {
                return;
            }
            setActiveElement(target);
        };
        /**
         * @param {Event} evt
         */
        canvasElement.onkeypress = function (evt) {
            var str;
            if (evt.charCode && !evt.ctrlKey) {
                str = String.fromCharCode(evt.charCode);
                canvas.getCaret().leftText().appendData(str);
                cancelEvent(evt);
            }
        };
        /**
         * @param {Event} evt
         */
        canvasElement.onkeydown = function (evt) {
            if (evt.charCode) {
                return;
            }
            var key = evt.keyCode,
                caret = canvas.getCaret(),
                t,
                activeElement;
            if (evt.ctrlKey) {
                if (key === 40) { // down
                    caret.nextSibling();
                } else if (key === 38) { // up
                    caret.previousSibling();
                } else if (key === 37) { // left
                    caret.up();
                } else if (key === 39) { // right
                    caret.down();
                }
                activeElement = caret.getActiveElement();
                if (activeElement) {
                    setActiveElement(activeElement);
                }
            } else {
                if (key === 37) { // left
                    caret.left();
                } else if (key === 39) { // right
                    caret.right();
                } else if (key === 40) { // down
                    caret.nextSibling();
                } else if (key === 38) { // up
                    caret.previousSibling();
                } else if (key === 8) { // backspace
                    t = caret.leftText();
                    if (t.length) {
                        t.deleteData(t.length - 1, 1);
                    }
                } else if (key === 46) { // delete
                    t = caret.rightText();
                    if (t.length) {
                        t.deleteData(0, 1);
                    }
                }
            }
        };
        document.body.onblur = canvasElement.onblur = function () {
            var caret = canvas.getCaret();
            caret.removeFocus();
        };
        document.body.onfocus = canvasElement.onfocus = function () {
            var caret = canvas.getCaret();
            caret.setFocus();
        };
 
        runtime.getWindow().onresize = fixSize;
        fixSize();
    }
    /**
     * @param {!string} url
     * @return {undefined}
     */
    this.load = function (url) {
        canvas.load(url, function () {
            function setup() {
                var root = canvas.getDocumentRoot(),
                    list = root.getElementsByTagNameNS("", "titel"),
                    sel = runtime.getWindow().getSelection(),
                    r = doc.createRange(),
                    e = (list.length > 0) ? list.item(0) : null;
                if (initCrumbBar()) {
                    crumbBar.setDocumentRoot(root);
                }
                // hack to select start of doc
                if (e) {
                    r.setStart(e, 0);
                    r.setEnd(e, 0);
                    sel.addRange(r);
                    setActiveElement(/**@type{!Element}*/(e));
                }
            }
            function waitForModel() {
                var state = validationModel.getState();
                if (state === xmled.ValidationModel.State.LOADING) {
                    runtime.getWindow().setTimeout(waitForModel, 10);
                } else {
                    setup();
                }
            }
            runtime.getWindow().setTimeout(waitForModel, 10);
        });
    };
    /**
     * @param {function(?string):undefined} callback
     * @return {undefined}
     */
    this.save = function (callback) {
        callback(null);
    };
    init();
};
/**
 * @enum {number}
 */
xmled.XmlEditor.State = {
    EMPTY:   0,
    LOADING: 1,
    ERROR:   2,
    READY:   3
};
(function () {
    "use strict";
    return xmled.XmlEditor;
}());
