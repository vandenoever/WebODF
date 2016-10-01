/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global Node, NodeFilter, DOMParser, document, webodf */

"use strict";
var Base64 = require("../core/Base64").Base64;
var domUtils = require("../core/DomUtils");
var Zip = require("../core/Zip").Zip;
var Namespaces = require("./Namespaces").Namespaces;
var OdfNodeFilter = require("./OdfNodeFilter").OdfNodeFilter;
var StyleInfo = require("./StyleInfo").StyleInfo;
var runtime = require("../runtime").runtime;
var LSSerializer = require("../xmldom/LSSerializer").LSSerializer;
var LSSerializerFilter = require("../xmldom/LSSerializerFilter").LSSerializerFilter;

var styleInfo = new StyleInfo();

    var /**@const
           @type{!string}*/
        officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        /**@const
           @type{!string}*/
        manifestns = "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0",
        /**@const
           @type{!string}*/
        webodfns = "urn:webodf:names:scope",
        /**@const
           @type{!string}*/
        stylens = Namespaces.stylens,
        /**@const
           @type{!Array.<!string>}*/
        nodeorder = ['meta', 'settings', 'scripts', 'font-face-decls', 'styles',
            'automatic-styles', 'master-styles', 'body'],
        /**@const
           @type{!string}*/
        automaticStylePrefix = Date.now() + "_webodf_",
        base64 = new Base64(),
        /**@const
           @type{!string}*/
        documentStylesScope = "document-styles",
        /**@const
           @type{!string}*/
        documentContentScope = "document-content";

    /**
     * Return the position the node should get according to the ODF flat format.
     * @param {!Node} child
     * @return {!number}
     */
    function getNodePosition(child) {
        var i, l = nodeorder.length;
        for (i = 0; i < l; i += 1) {
            if (child.namespaceURI === officens &&
                    child.localName === nodeorder[i]) {
                return i;
            }
        }
        return -1;
    }
    /**
     * Class that filters runtime specific nodes from the DOM.
     * Additionally all unused automatic styles are skipped, if a tree
     * of elements was passed to check the style usage in it.
     * @constructor
     * @implements {LSSerializerFilter}
     * @param {!Element} styleUsingElementsRoot root element of tree of elements using styles
     * @param {?Element=} automaticStyles root element of the automatic style definition tree
     */
    function OdfStylesFilter(styleUsingElementsRoot, automaticStyles) {
        var usedStyleList = new styleInfo.UsedStyleList(styleUsingElementsRoot, automaticStyles),
            odfNodeFilter = new OdfNodeFilter();

        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var result = odfNodeFilter.acceptNode(node);
            if (result === NodeFilter.FILTER_ACCEPT
                    && node.parentNode === automaticStyles
                    && node.nodeType === Node.ELEMENT_NODE) {
                // skip all automatic styles which are not used
                if (usedStyleList.uses(/**@type{!Element}*/(node))) {
                    result = NodeFilter.FILTER_ACCEPT;
                } else {
                    result = NodeFilter.FILTER_REJECT;
                }
            }
            return result;
        };
    }
    /**
     * Class that extends OdfStylesFilter
     * Additionally, filter out ' ' within the <text:s> element and '\t' within the <text:tab> element
     * @constructor
     * @implements {LSSerializerFilter}
     * @param {!Element} styleUsingElementsRoot root element of tree of elements using styles
     * @param {?Element=} automaticStyles root element of the automatic style definition tree
     */
    function OdfContentFilter(styleUsingElementsRoot, automaticStyles) {
        var odfStylesFilter = new OdfStylesFilter(styleUsingElementsRoot, automaticStyles);

        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            var result = odfStylesFilter.acceptNode(node);
            if (result === NodeFilter.FILTER_ACCEPT
                    && node.parentNode
                    && node.parentNode.namespaceURI === Namespaces.textns
                    && (node.parentNode.localName === 's' || node.parentNode.localName === 'tab')) {
                result = NodeFilter.FILTER_REJECT;
            }
            return result;
        };
    }
    /**
     * Put the element at the right position in the parent.
     * The right order is given by the value returned from getNodePosition.
     * @param {!Node} node
     * @param {?Node} child
     * @return {undefined}
     */
    function setChild(node, child) {
        if (!child) {
            return;
        }
        var childpos = getNodePosition(child),
            pos,
            c = node.firstChild;
        if (childpos === -1) {
            return;
        }
        while (c) {
            pos = getNodePosition(c);
            if (pos !== -1 && pos > childpos) {
                break;
            }
            c = c.nextSibling;
        }
        node.insertBefore(child, c);
    }
    /*jslint emptyblock: true*/
    /**
     * A DOM element that is part of and ODF part of a DOM.
     * @constructor
     * @extends {Element}
     */
    var ODFElement = function ODFElement() {
    };
    /**
     * The root element of an ODF document.
     * @constructor
     * @extends {ODFElement}
     */
    function ODFDocumentElement() {}
/**@const*/
exports.ODFDocumentElement = ODFDocumentElement;
    /*jslint emptyblock: false*/
    ODFDocumentElement.prototype = new ODFElement();
    ODFDocumentElement.prototype.constructor = ODFDocumentElement;
    /**
     * Optional tag <office:automatic-styles/>
     * If it is missing, it is created.
     * @type {!Element}
     */
    ODFDocumentElement.prototype.automaticStyles;
    /**
     * Required tag <office:body/>
     * @type {!Element}
     */
    ODFDocumentElement.prototype.body;
    /**
     * Optional tag <office:font-face-decls/>
     * @type {Element}
     */
    ODFDocumentElement.prototype.fontFaceDecls = null;
    /**
     * @type {Element}
     */
    ODFDocumentElement.prototype.manifest = null;
    /**
     * Optional tag <office:master-styles/>
     * If it is missing, it is created.
     * @type {!Element}
     */
    ODFDocumentElement.prototype.masterStyles;
    /**
     * Optional tag <office:meta/>
     * @type {?Element}
     */
    ODFDocumentElement.prototype.meta;
    /**
     * Optional tag <office:settings/>
     * @type {Element}
     */
    ODFDocumentElement.prototype.settings = null;
    /**
     * Optional tag <office:styles/>
     * If it is missing, it is created.
     * @type {!Element}
     */
    ODFDocumentElement.prototype.styles;
    ODFDocumentElement.namespaceURI = officens;
    ODFDocumentElement.localName = 'document';

    /*jslint emptyblock: true*/
    /**
     * An element that also has a pointer to the optional annotation end
     * @constructor
     * @extends {ODFElement}
     */
    function AnnotationElement() {}
/**@const*/
exports.AnnotationElement = AnnotationElement;
    /*jslint emptyblock: false*/

    /**
    * @type {?Element}
    */
    AnnotationElement.prototype.annotationEndElement;

    // private constructor
    /**
     * @constructor
     * @param {string} name
     * @param {string} mimetype
     * @param {!OdfContainer} container
     * @param {Zip} zip
     */
    function OdfPart(name, mimetype,  container, zip) {
        var self = this;

        // declare public variables
        this.size = 0;
        this.type = null;
        this.name = name;
        this.container = container;
        /**@type{?string}*/
        this.url = null;
        /**@type{string}*/
        this.mimetype = mimetype;
        this.document = null;
        this.onstatereadychange = null;
        /**@type{?function(!OdfPart)}*/
        this.onchange;
        this.EMPTY = 0;
        this.LOADING = 1;
        this.DONE = 2;
        this.state = this.EMPTY;
        this.data = "";

        // private functions
        // public functions
        /**
         * @return {undefined}
         */
        this.load = function () {
            if (zip === null) {
                return;
            }
            this.mimetype = mimetype;
            zip.loadAsDataURL(name, mimetype, function (err, url) {
                if (err) {
                    runtime.log(err);
                }
                self.url = url;
                if (self.onchange) {
                    self.onchange(self);
                }
                if (self.onstatereadychange) {
                    self.onstatereadychange(self);
                }
            });
        };
    }
/**@const*/
exports.OdfPart = OdfPart;
    /*jslint emptyblock: true*/
    OdfPart.prototype.load = function () {
    };
    /*jslint emptyblock: false*/
    OdfPart.prototype.getUrl = function () {
        if (this.data) {
            return 'data:;base64,' + base64.toBase64(this.data);
        }
        return null;
    };
    /**
     * The OdfContainer class manages the various parts that constitues an ODF
     * document.
     * The constructor takes a url or a type. If urlOrType is a type, an empty
     * document of that type is created. Otherwise, urlOrType is interpreted as
     * a url and loaded from that url.
     *
     * @constructor
     * @param {!string|!OdfContainer.DocumentType} urlOrType
     * @param {?function(!OdfContainer)=} onstatereadychange
     * @return {?}
     */
    function OdfContainer(urlOrType, onstatereadychange) {
        var self = this,
            /**@type {!Zip}*/
            zip,
            /**@type {!Object.<!string,!string>}*/
            partMimetypes = {},
            /**@type {?Element}*/
            contentElement,
            /**@type{!string}*/
            url = "";

        // NOTE each instance of OdfContainer has a copy of the private functions
        // it would be better to have a class OdfContainerPrivate where the
        // private functions can be defined via OdfContainerPrivate.prototype
        // without exposing them

        // declare public variables
        this.onstatereadychange = onstatereadychange;
        this.onchange = null;
        this.state = null;
        /**
         * @type {!ODFDocumentElement}
         */
        this.rootElement;

        /**
         * @param {!Element} element
         * @return {undefined}
         */
        function removeProcessingInstructions(element) {
            var n = element.firstChild, next, e;
            while (n) {
                next = n.nextSibling;
                if (n.nodeType === Node.ELEMENT_NODE) {
                    e = /**@type{!Element}*/(n);
                    removeProcessingInstructions(e);
                } else if (n.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
                    element.removeChild(n);
                }
                n = next;
            }
        }

        // private functions
        /**
         * Iterates through the subtree of rootElement and adds annotation-end
         * elements as direct properties of the corresponding annotation elements.
         * Expects properly used annotation elements, does not try
         * to do heuristic fixes or drop broken elements.
         * @param {!Element} rootElement
         * @return {undefined}
         */
        function linkAnnotationStartAndEndElements(rootElement) {
            var document = rootElement.ownerDocument,
                /** @type {!Object.<!string,!Element>} */
                annotationStarts = {},
                n, name, annotationStart,
                // TODO: optimize by using a filter rejecting subtrees without annotations possible
                nodeIterator = document.createNodeIterator(rootElement, NodeFilter.SHOW_ELEMENT, null, false);

            n = /**@type{?Element}*/(nodeIterator.nextNode());
            while (n) {
                if (n.namespaceURI === officens) {
                    if (n.localName === "annotation") {
                        name = n.getAttributeNS(officens, 'name');
                        if (name) {
                            if (annotationStarts.hasOwnProperty(name)) {
                                runtime.log("Warning: annotation name used more than once with <office:annotation/>: '" + name + "'");
                            } else {
                                annotationStarts[name] = n;
                            }
                        }
                    } else if (n.localName === "annotation-end") {
                        name = n.getAttributeNS(officens, 'name');
                        if (name) {
                            if (annotationStarts.hasOwnProperty(name)) {
                                annotationStart = /** @type {!AnnotationElement}*/(annotationStarts[name]);
                                if (!annotationStart.annotationEndElement) {
                                    // Linking annotation start & end
                                    annotationStart.annotationEndElement = n;
                                } else {
                                    runtime.log("Warning: annotation name used more than once with <office:annotation-end/>: '" + name + "'");
                                }
                            } else {
                                runtime.log("Warning: annotation end without an annotation start, name: '" + name + "'");
                            }
                        } else {
                            runtime.log("Warning: annotation end without a name found");
                        }
                    }
                }
                n = /**@type{?Element}*/(nodeIterator.nextNode());
            }
        }

        /**
         * Tags all styles with an attribute noting their scope.
         * Helper function for the primitive complete backwriting of
         * the automatic styles.
         * @param {?Element} stylesRootElement
         * @param {!string} scope
         * @return {undefined}
         */
        function setAutomaticStylesScope(stylesRootElement, scope) {
            var n = stylesRootElement && stylesRootElement.firstChild;
            while (n) {
                if (n.nodeType === Node.ELEMENT_NODE) {
                    /**@type{!Element}*/(n).setAttributeNS(webodfns, "scope", scope);
                }
                n = n.nextSibling;
            }
        }

        /**
         * Returns the meta element. If it did not exist before, it will be created.
         * @return {!Element}
         */
        function getEnsuredMetaElement() {
            var root = self.rootElement,
                meta = root.meta;

            if (!meta) {
                root.meta = meta = document.createElementNS(officens, "meta");
                setChild(root, meta);
            }

            return meta;
        }

        /**
         * @param {!string} metadataNs
         * @param {!string} metadataLocalName
         * @return {?string}
         */
        function getMetadata(metadataNs, metadataLocalName) {
            var node = self.rootElement.meta, textNode;

            node = node && node.firstChild;
            while (node && (node.namespaceURI !== metadataNs || node.localName !== metadataLocalName)) {
                node = node.nextSibling;
            }
            node = node && node.firstChild;
            while (node && node.nodeType !== Node.TEXT_NODE) {
                node = node.nextSibling;
            }
            if (node) {
                textNode = /**@type{!Text}*/(node);
                return textNode.data;
            }
            return null;
        }
        this.getMetadata = getMetadata;

        /**
         * Returns key with a number postfix or none, as key unused both in map1 and map2.
         * @param {!string} key
         * @param {!Object} map1
         * @param {!Object} map2
         * @return {!string}
         */
        function unusedKey(key, map1, map2) {
            var i = 0, postFixedKey;

            // cut any current postfix number
            key = key.replace(/\d+$/, '');
            // start with no postfix, continue with i = 1, aiming for the simpelst unused number or key
            postFixedKey = key;
            while (map1.hasOwnProperty(postFixedKey) || map2.hasOwnProperty(postFixedKey)) {
                i += 1;
                postFixedKey = key + i;
            }

            return postFixedKey;
        }

        /**
         * Returns a map with the fontface declaration elements, with font-face name as key.
         * @param {!Element} fontFaceDecls
         * @return {!Object.<!string,!Element>}
          */
        function mapByFontFaceName(fontFaceDecls) {
            var fn, result = {}, fontname;
            // create map of current target decls
            fn = fontFaceDecls.firstChild;
            while (fn) {
                if (fn.nodeType === Node.ELEMENT_NODE
                        && fn.namespaceURI === stylens
                        && fn.localName === "font-face") {
                    fontname = /**@type{!Element}*/(fn).getAttributeNS(stylens, "name");
                    // assuming existance and uniqueness of style:name here
                    result[fontname] = fn;
                }
                fn = fn.nextSibling;
            }
            return result;
        }

        /**
         * Merges all style:font-face elements from the source into the target.
         * Skips elements equal to one already in the target.
         * Elements with the same style:name but different properties get a new
         * value for style:name. Any name changes are logged and returned as a map
         * with the old names as keys.
         * @param {!Element} targetFontFaceDeclsRootElement
         * @param {!Element} sourceFontFaceDeclsRootElement
         * @return {!Object.<!string,!string>}  mapping of old font-face name to new
         */
        function mergeFontFaceDecls(targetFontFaceDeclsRootElement, sourceFontFaceDeclsRootElement) {
            var e, s, fontFaceName, newFontFaceName,
                targetFontFaceDeclsMap, sourceFontFaceDeclsMap,
                fontFaceNameChangeMap = {};

            targetFontFaceDeclsMap = mapByFontFaceName(targetFontFaceDeclsRootElement);
            sourceFontFaceDeclsMap = mapByFontFaceName(sourceFontFaceDeclsRootElement);

            // merge source decls into target
            e = sourceFontFaceDeclsRootElement.firstElementChild;
            while (e) {
                s = e.nextElementSibling;
                if (e.namespaceURI === stylens && e.localName === "font-face") {
                    fontFaceName = e.getAttributeNS(stylens, "name");
                    // already such a name used in target?
                    if (targetFontFaceDeclsMap.hasOwnProperty(fontFaceName)) {
                        // skip it if the declarations are equal, otherwise insert with a new, unused name
                        if (!e.isEqualNode(targetFontFaceDeclsMap[fontFaceName])) {
                            newFontFaceName = unusedKey(fontFaceName, targetFontFaceDeclsMap, sourceFontFaceDeclsMap);
                            e.setAttributeNS(stylens, "style:name", newFontFaceName);
                            // copy with a new name
                            targetFontFaceDeclsRootElement.appendChild(e);
                            targetFontFaceDeclsMap[newFontFaceName] = e;
                            delete sourceFontFaceDeclsMap[fontFaceName];
                            // note name change
                            fontFaceNameChangeMap[fontFaceName] = newFontFaceName;
                        }
                    } else {
                        // move over
                        // perhaps one day it could also be checked if there is an equal declaration
                        // with a different name, but that has yet to be seen in real life
                        targetFontFaceDeclsRootElement.appendChild(e);
                        targetFontFaceDeclsMap[fontFaceName] = e;
                        delete sourceFontFaceDeclsMap[fontFaceName];
                    }
                }
                e = s;
            }
            return fontFaceNameChangeMap;
        }

        /**
         * Creates a clone of the styles tree containing only styles tagged
         * with the given scope, or with no specified scope.
         * Helper function for the primitive complete backwriting of
         * the automatic styles.
         * @param {?Element} stylesRootElement
         * @param {!string} scope
         * @return {?Element}
         */
        function cloneStylesInScope(stylesRootElement, scope) {
            var copy = null, e, s, scopeAttrValue;
            if (stylesRootElement) {
                copy = stylesRootElement.cloneNode(true);
                e = copy.firstElementChild;
                while (e) {
                    s = e.nextElementSibling;
                    scopeAttrValue = e.getAttributeNS(webodfns, "scope");
                    if (scopeAttrValue && scopeAttrValue !== scope) {
                        copy.removeChild(e);
                    }
                    e = s;
                }
            }
            return copy;
        }
        /**
         * Creates a clone of the font face declaration tree containing only
         * those declarations which are referenced in the passed styles.
         * @param {?Element} fontFaceDeclsRootElement
         * @param {!Array.<!Element>} stylesRootElementList
         * @return {?Element}
         */
        function cloneFontFaceDeclsUsedInStyles(fontFaceDeclsRootElement, stylesRootElementList) {
            var e, nextSibling, fontFaceName,
                copy = null,
                usedFontFaceDeclMap = {};

            if (fontFaceDeclsRootElement) {
                // first collect used font faces
                stylesRootElementList.forEach(function (stylesRootElement) {
                    styleInfo.collectUsedFontFaces(usedFontFaceDeclMap, stylesRootElement);
                });

                // then clone all font face declarations and drop those which are not in the list of used
                copy = fontFaceDeclsRootElement.cloneNode(true);
                e = copy.firstElementChild;
                while (e) {
                    nextSibling = e.nextElementSibling;
                    fontFaceName = e.getAttributeNS(stylens, "name");
                    if (!usedFontFaceDeclMap[fontFaceName]) {
                        copy.removeChild(e);
                    }
                    e = nextSibling;
                }
            }
            return copy;
        }

        /**
         * Import the document elementnode into the DOM of OdfContainer.
         * Any processing instructions are removed, since importing them
         * gives an exception.
         * @param {Document|undefined} xmldoc
         * @return {!Element|undefined}
         */
        function importRootNode(xmldoc) {
            var doc = self.rootElement.ownerDocument,
                node;
            // remove all processing instructions
            // TODO: replace cursor processing instruction with an element
            if (xmldoc) {
                removeProcessingInstructions(xmldoc.documentElement);
                try {
                    node = /**@type{!Element}*/(doc.importNode(xmldoc.documentElement, true));
                } catch (ignore) {
                }
            }
            return node;
        }
        /**
         * @param {!number} state
         * @return {undefined}
         */
        function setState(state) {
            self.state = state;
            if (self.onchange) {
                self.onchange(self);
            }
            if (self.onstatereadychange) {
                self.onstatereadychange(self);
            }
        }
        /**
         * @param {!Element} root
         * @return {undefined}
         */
        function setRootElement(root) {
            contentElement = null;
            self.rootElement = /**@type{!ODFDocumentElement}*/(root);
            root.fontFaceDecls = domUtils.getDirectChild(root, officens, 'font-face-decls');
            root.styles = domUtils.getDirectChild(root, officens, 'styles');
            root.automaticStyles = domUtils.getDirectChild(root, officens, 'automatic-styles');
            root.masterStyles = domUtils.getDirectChild(root, officens, 'master-styles');
            root.body = domUtils.getDirectChild(root, officens, 'body');
            root.meta = domUtils.getDirectChild(root, officens, 'meta');
            root.settings = domUtils.getDirectChild(root, officens, 'settings');
            root.scripts = domUtils.getDirectChild(root, officens, 'scripts');
            linkAnnotationStartAndEndElements(root);
        }
        /**
         * @param {Document|undefined} xmldoc
         * @return {undefined}
         */
        function handleFlatXml(xmldoc) {
            var root = importRootNode(xmldoc);
            if (!root || root.localName !== 'document' ||
                    root.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            setRootElement(/**@type{!Element}*/(root));
            setState(OdfContainer.DONE);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleStylesXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root = self.rootElement,
                n;
            if (!node || node.localName !== 'document-styles' ||
                    node.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            root.fontFaceDecls = domUtils.getDirectChild(node, officens, 'font-face-decls');
            setChild(root, root.fontFaceDecls);
            n = domUtils.getDirectChild(node, officens, 'styles');
            root.styles = n || xmldoc.createElementNS(officens, 'styles');
            setChild(root, root.styles);
            n = domUtils.getDirectChild(node, officens, 'automatic-styles');
            root.automaticStyles = n || xmldoc.createElementNS(officens, 'automatic-styles');
            setAutomaticStylesScope(root.automaticStyles, documentStylesScope);
            setChild(root, root.automaticStyles);
            node = domUtils.getDirectChild(node, officens, 'master-styles');
            root.masterStyles = node || xmldoc.createElementNS(officens,
                    'master-styles');
            setChild(root, root.masterStyles);
            // automatic styles from styles.xml could shadow automatic styles
            // from content.xml, because they could have the same name
            // so prefix them and their uses with some almost unique string
            styleInfo.prefixStyleNames(root.automaticStyles, automaticStylePrefix, root.masterStyles);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleContentXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root,
                automaticStyles,
                fontFaceDecls,
                fontFaceNameChangeMap,
                c;
            if (!node || node.localName !== 'document-content' ||
                    node.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            root = self.rootElement;
            fontFaceDecls = domUtils.getDirectChild(node, officens, 'font-face-decls');
            if (root.fontFaceDecls && fontFaceDecls) {
                fontFaceNameChangeMap = mergeFontFaceDecls(root.fontFaceDecls, fontFaceDecls);
            } else if (fontFaceDecls) {
                root.fontFaceDecls = fontFaceDecls;
                setChild(root, fontFaceDecls);
            }
            automaticStyles = domUtils.getDirectChild(node, officens, 'automatic-styles');
            setAutomaticStylesScope(automaticStyles, documentContentScope);
            if (fontFaceNameChangeMap) {
                styleInfo.changeFontFaceNames(automaticStyles, fontFaceNameChangeMap);
            }
            if (root.automaticStyles && automaticStyles) {
                c = automaticStyles.firstChild;
                while (c) {
                    root.automaticStyles.appendChild(c);
                    c = automaticStyles.firstChild; // works because node c moved
                }
            } else if (automaticStyles) {
                root.automaticStyles = automaticStyles;
                setChild(root, automaticStyles);
            }
            node = domUtils.getDirectChild(node, officens, 'body');
            if (node === null) {
                throw "<office:body/> tag is mising.";
            }
            root.body = node;
            setChild(root, root.body);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleMetaXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root;
            if (!node || node.localName !== 'document-meta' ||
                    node.namespaceURI !== officens) {
                return;
            }
            root = self.rootElement;
            root.meta = domUtils.getDirectChild(node, officens, 'meta');
            setChild(root, root.meta);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleSettingsXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root;
            if (!node || node.localName !== 'document-settings' ||
                    node.namespaceURI !== officens) {
                return;
            }
            root = self.rootElement;
            root.settings = domUtils.getDirectChild(node, officens, 'settings');
            setChild(root, root.settings);
        }
        /**
         * @param {Document} xmldoc
         * @return {undefined}
         */
        function handleManifestXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root,
                e;
            if (!node || node.localName !== 'manifest' ||
                    node.namespaceURI !== manifestns) {
                return;
            }
            root = self.rootElement;
            root.manifest = /**@type{!Element}*/(node);
            e = root.manifest.firstElementChild;
            while (e) {
                if (e.localName === "file-entry" &&
                        e.namespaceURI === manifestns) {
                    partMimetypes[e.getAttributeNS(manifestns, "full-path")] =
                        e.getAttributeNS(manifestns, "media-type");
                }
                e = e.nextElementSibling;
            }
        }
        /**
         * @param {!Document} xmldoc
         * @param {!string} localName
         * @param {!Object.<!string,!boolean>} allowedNamespaces
         * @return {undefined}
         */
        function removeElements(xmldoc, localName, allowedNamespaces) {
            var elements = domUtils.getElementsByTagName(xmldoc, localName),
                element,
                i;
            for (i = 0; i < elements.length; i += 1) {
                element = elements[i];
                if (!allowedNamespaces.hasOwnProperty(element.namespaceURI)) {
                    element.parentNode.removeChild(element);
                }
            }
        }
        /**
         * Remove any HTML <script/> tags from the DOM.
         * The tags need to be removed, because otherwise they would be executed
         * when the dom is inserted into the document.
         * To be safe, all elements with localName "script" are removed, unless
         * they are in a known, allowed namespace.
         * @param {!Document} xmldoc
         * @return {undefined}
         */
        function removeDangerousElements(xmldoc) {
            removeElements(xmldoc, "script", {
                "urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0": true,
                "urn:oasis:names:tc:opendocument:xmlns:office:1.0": true,
                "urn:oasis:names:tc:opendocument:xmlns:table:1.0": true,
                "urn:oasis:names:tc:opendocument:xmlns:text:1.0": true,
                "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0": true
            });
            removeElements(xmldoc, "style", {
                "urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0": true,
                "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0": true,
                "urn:oasis:names:tc:opendocument:xmlns:style:1.0": true
            });
        }

        /**
         * Remove all attributes that have no namespace and that have
         * localname like 'on....', the event handler attributes.
         * @param {!Element} element
         * @return {undefined}
         */
        function removeDangerousAttributes(element) {
            var e = element.firstElementChild, as = [], i, n, a,
                atts = element.attributes,
                l = atts.length;
            // collect all dangerous attributes
            for (i = 0; i < l; i += 1) {
                a = atts.item(i);
                n = a.localName.substr(0, 2).toLowerCase();
                if (a.namespaceURI === null && n === "on") {
                    as.push(a);
                }
            }
            // remove the dangerous attributes
            l = as.length;
            for (i = 0; i < l; i += 1) {
                element.removeAttributeNode(as[i]);
            }
            // recurse into the child elements
            while (e) {
                removeDangerousAttributes(e);
                e = e.nextElementSibling;
            }
        }

        /**
         * @param {!Array.<!{path:string,handler:function(?Document)}>} remainingComponents
         * @return {undefined}
         */
        function loadNextComponent(remainingComponents) {
            var component = remainingComponents.shift();

            if (component) {
                zip.loadAsDOM(component.path, function (err, xmldoc) {
                    if (xmldoc) {
                        removeDangerousElements(xmldoc);
                        removeDangerousAttributes(xmldoc.documentElement);
                    }
                    component.handler(xmldoc);
                    if (self.state === OdfContainer.INVALID) {
                        if (err) {
                            runtime.log("ERROR: Unable to load " + component.path + " - " + err);
                        } else {
                            runtime.log("ERROR: Unable to load " + component.path);
                        }
                        return;
                    }
                    if (err) {
                        runtime.log("DEBUG: Unable to load " + component.path + " - " + err);
                    }
                    loadNextComponent(remainingComponents);
                });
            } else {
                linkAnnotationStartAndEndElements(self.rootElement);
                setState(OdfContainer.DONE);
            }
        }
        /**
         * @return {undefined}
         */
        function loadComponents() {
            var componentOrder = [
                {path: 'styles.xml', handler: handleStylesXml},
                {path: 'content.xml', handler: handleContentXml},
                {path: 'meta.xml', handler: handleMetaXml},
                {path: 'settings.xml', handler: handleSettingsXml},
                {path: 'META-INF/manifest.xml', handler: handleManifestXml}
            ];
            loadNextComponent(componentOrder);
        }
        /**
         * @param {!string} name
         * @return {!string}
         */
        function createDocumentElement(name) {
            var /**@type{string}*/
                s = "";

            /**
             * @param {string} prefix
             * @param {string} ns
             */
            function defineNamespace(prefix, ns) {
                s += " xmlns:" + prefix + "=\"" + ns + "\"";
            }
            Namespaces.forEachPrefix(defineNamespace);
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><office:" + name +
                    " " + s + " office:version=\"1.2\">";
        }
        /**
         * @return {!string}
         */
        function serializeMetaXml() {
            var serializer = new LSSerializer(),
                /**@type{!string}*/
                s = createDocumentElement("document-meta");
            serializer.filter = new OdfNodeFilter();
            s += serializer.writeToString(self.rootElement.meta, Namespaces.namespaceMap);
            s += "</office:document-meta>";
            return s;
        }
        /**
         * Creates a manifest:file-entry node
         * @param {!string} fullPath Full-path attribute value for the file-entry
         * @param {!string} mediaType Media-type attribute value for the file-entry
         * @return {!Node}
         */
        function createManifestEntry(fullPath, mediaType) {
            var element = document.createElementNS(manifestns, 'manifest:file-entry');
            element.setAttributeNS(manifestns, 'manifest:full-path', fullPath);
            element.setAttributeNS(manifestns, 'manifest:media-type', mediaType);
            return element;
        }
        /**
         * @return {string}
         */
        function serializeManifestXml() {
            var header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
                xml = '<manifest:manifest xmlns:manifest="' + manifestns + '" manifest:version="1.2"></manifest:manifest>',
                manifest = /**@type{!Document}*/(runtime.parseXML(xml)),
                manifestRoot = manifest.documentElement,
                serializer = new LSSerializer(),
                /**@type{string}*/
                fullPath;

            for (fullPath in partMimetypes) {
                if (partMimetypes.hasOwnProperty(fullPath)) {
                    manifestRoot.appendChild(createManifestEntry(fullPath, partMimetypes[fullPath]));
                }
            }
            serializer.filter = new OdfNodeFilter();
            return header + serializer.writeToString(manifest, Namespaces.namespaceMap);
        }
        /**
         * @return {!string}
         */
        function serializeSettingsXml() {
            var serializer = new LSSerializer(),
                /**@type{!string}*/
                s = createDocumentElement("document-settings");
            // <office:settings/> is optional, but if present must have at least one child element
            if (self.rootElement.settings && self.rootElement.settings.firstElementChild) {
                serializer.filter = new OdfNodeFilter();
                s += serializer.writeToString(self.rootElement.settings, Namespaces.namespaceMap);
            }
            return s + "</office:document-settings>";
        }
        /**
         * @return {!string}
         */
        function serializeStylesXml() {
            var fontFaceDecls, automaticStyles, masterStyles,
                nsmap = Namespaces.namespaceMap,
                serializer = new LSSerializer(),
                /**@type{!string}*/
                s = createDocumentElement("document-styles");

            // special handling for merged toplevel nodes
            automaticStyles = cloneStylesInScope(
                self.rootElement.automaticStyles,
                documentStylesScope
            );
            masterStyles = /**@type{!Element}*/(self.rootElement.masterStyles.cloneNode(true));
            fontFaceDecls = cloneFontFaceDeclsUsedInStyles(self.rootElement.fontFaceDecls, [masterStyles, self.rootElement.styles, automaticStyles]);

            // automatic styles from styles.xml could shadow automatic styles from content.xml,
            // because they could have the same name
            // thus they were prefixed on loading with some almost unique string, which cam be removed
            // again before saving
            styleInfo.removePrefixFromStyleNames(automaticStyles,
                    automaticStylePrefix, masterStyles);
            serializer.filter = new OdfStylesFilter(masterStyles, automaticStyles);

            s += serializer.writeToString(fontFaceDecls, nsmap);
            s += serializer.writeToString(self.rootElement.styles, nsmap);
            s += serializer.writeToString(automaticStyles, nsmap);
            s += serializer.writeToString(masterStyles, nsmap);
            s += "</office:document-styles>";
            return s;
        }
        /**
         * @return {!string}
         */
        function serializeContentXml() {
            var fontFaceDecls, automaticStyles,
                nsmap = Namespaces.namespaceMap,
                serializer = new LSSerializer(),
                /**@type{!string}*/
                s = createDocumentElement("document-content");

            // special handling for merged toplevel nodes
            automaticStyles = cloneStylesInScope(self.rootElement.automaticStyles, documentContentScope);
            fontFaceDecls = cloneFontFaceDeclsUsedInStyles(self.rootElement.fontFaceDecls, [automaticStyles]);

            serializer.filter = new OdfContentFilter(self.rootElement.body, automaticStyles);

            s += serializer.writeToString(fontFaceDecls, nsmap);
            s += serializer.writeToString(automaticStyles, nsmap);
            s += serializer.writeToString(self.rootElement.body, nsmap);
            s += "</office:document-content>";
            return s;
        }
        /**
         * @param {!{Type:function(new:Object),namespaceURI:string,localName:string}} type
         * @return {!Element}
         */
        function createElement(type) {
            var original = document.createElementNS(
                    type.namespaceURI,
                    type.localName
                ),
                /**@type{string}*/
                method,
                iface = new type.Type();
            for (method in iface) {
                if (iface.hasOwnProperty(method)) {
                    original[method] = iface[method];
                }
            }
            return original;
        }
        /**
         * @param {!string} url
         * @param {!function((string)):undefined} callback
         * @return {undefined}
         */
        function loadFromXML(url, callback) {
            /**
             * @param {?string} err
             * @param {?Document} dom
             */
            function handler(err, dom) {
                if (err) {
                    callback(err);
                } else if (!dom) {
                    callback("No DOM was loaded.");
                } else {
                    removeDangerousElements(dom);
                    removeDangerousAttributes(dom.documentElement);
                    handleFlatXml(dom);
                }
            }
            runtime.loadXML(url, handler);
        }
        // public functions
        this.setRootElement = setRootElement;

        /**
         * @return {!Element}
         */
        this.getContentElement = function () {
            var /**@type{!Element}*/
                body;
            if (!contentElement) {
                body = self.rootElement.body;
                contentElement = domUtils.getDirectChild(body, officens, "text")
                    || domUtils.getDirectChild(body, officens, "presentation")
                    || domUtils.getDirectChild(body, officens, "spreadsheet");
            }
            if (!contentElement) {
                throw "Could not find content element in <office:body/>.";
            }
            return contentElement;
        };

        /**
         * Gets the document type as 'text', 'presentation', or 'spreadsheet'.
         * @return {!string}
         */
        this.getDocumentType = function () {
            var content = self.getContentElement();
            return content && content.localName;
        };

        /**
         * Returns whether the document is a template.
         * @return {!boolean}
         */
        this.isTemplate = function () {
            var docMimetype = partMimetypes["/"];
            return (docMimetype.substr(-9) === "-template");
        };

         /**
         * Sets whether the document is a template or not.
         * @param {!boolean} isTemplate
         * @return {undefined}
         */
       this.setIsTemplate = function (isTemplate) {
            var docMimetype = partMimetypes["/"],
                oldIsTemplate = (docMimetype.substr(-9) === "-template"),
                data;

            if (isTemplate === oldIsTemplate) {
                return;
            }

            if (isTemplate) {
                docMimetype = docMimetype + "-template";
            } else {
                docMimetype = docMimetype.substr(0, docMimetype.length-9);
            }

            partMimetypes["/"] = docMimetype;
            data = runtime.byteArrayFromString(docMimetype, "utf8");
            zip.save("mimetype", data, false, new Date());
        };

        /**
         * Open file and parse it. Return the XML Node. Return the root node of
         * the file or null if this is not possible.
         * For 'content.xml', 'styles.xml', 'meta.xml', and 'settings.xml', the
         * elements 'document-content', 'document-styles', 'document-meta', or
         * 'document-settings' will be returned respectively.
         * @param {string} partname
         * @return {!OdfPart}
         **/
        this.getPart = function (partname) {
            return new OdfPart(partname, partMimetypes[partname], self, zip);
        };
        /**
         * @param {string} url
         * @param {function(?string, ?Uint8Array)} callback receiving err and data
         * @return {undefined}
         */
        this.getPartData = function (url, callback) {
            zip.load(url, callback);
        };

        /**
         * Sets the metadata fields from the given properties map.
         * @param {?Object.<!string, !string>} setProperties A flat object that is a string->string map of field name -> value.
         * @param {?Array.<!string>} removedPropertyNames An array of metadata field names (prefixed).
         * @return {undefined}
         */
        function setMetadata(setProperties, removedPropertyNames) {
            var metaElement = getEnsuredMetaElement();

            if (setProperties) {
                domUtils.mapKeyValObjOntoNode(metaElement, setProperties, Namespaces.lookupNamespaceURI);
            }
            if (removedPropertyNames) {
                domUtils.removeKeyElementsFromNode(metaElement, removedPropertyNames, Namespaces.lookupNamespaceURI);
            }
        }
        this.setMetadata = setMetadata;

        /**
         * Increment the number of times the document has been edited.
         * @return {!number} new number of editing cycles
         */
        this.incrementEditingCycles = function () {
            var currentValueString = getMetadata(Namespaces.metans, "editing-cycles"),
                currentCycles = currentValueString ? parseInt(currentValueString, 10) : 0;

            if (isNaN(currentCycles)) {
                currentCycles = 0;
            }

            setMetadata({"meta:editing-cycles": currentCycles + 1}, null);
            return currentCycles + 1;
        };

        /**
         * Write pre-saving metadata to the DOM
         * @return {undefined}
         */
        function updateMetadataForSaving() {
            // set the opendocument provider used to create/
            // last modify the document.
            // this string should match the definition for
            // user-agents in the http protocol as specified
            // in section 14.43 of [RFC2616].
            var generatorString,
                window = runtime.getWindow();

            generatorString = "WebODF/" + "?";//runtime.Version;

            if (window) {
                generatorString = generatorString + " " + window.navigator.userAgent;
            }

            setMetadata({"meta:generator": generatorString}, null);
        }

        /**
         * @param {!string} type
         * @param {!boolean=} isTemplate  Default value is false.
         * @return {!Zip}
         */
        function createEmptyDocument(type, isTemplate) {
            var emptyzip = new Zip("", null),
                mimetype = "application/vnd.oasis.opendocument." + type + (isTemplate === true ? "-template" : ""),
                data = runtime.byteArrayFromString(
                    mimetype,
                    "utf8"
                ),
                root = self.rootElement,
                content = document.createElementNS(officens, type);
            emptyzip.save("mimetype", data, false, new Date());
            /**
             * @param {!string} memberName  variant of the real local name which allows dot notation
             * @param {!string=} realLocalName
             * @return {undefined}
             */
            function addToplevelElement(memberName, realLocalName) {
                var element;
                if (!realLocalName) {
                    realLocalName = memberName;
                }
                element = document.createElementNS(officens, realLocalName);
                root[memberName] = element;
                root.appendChild(element);
            }
            // add toplevel elements in correct order to the root node
            addToplevelElement("meta");
            addToplevelElement("settings");
            addToplevelElement("scripts");
            addToplevelElement("fontFaceDecls",   "font-face-decls");
            addToplevelElement("styles");
            addToplevelElement("automaticStyles", "automatic-styles");
            addToplevelElement("masterStyles",    "master-styles");
            addToplevelElement("body");
            root.body.appendChild(content);
            partMimetypes["/"] = mimetype;
            partMimetypes["settings.xml"] = "text/xml";
            partMimetypes["meta.xml"] = "text/xml";
            partMimetypes["styles.xml"] = "text/xml";
            partMimetypes["content.xml"] = "text/xml";

            setState(OdfContainer.DONE);
            return emptyzip;
        }

        /**
         * Fill the zip with current data.
         * @return {undefined}
         */
        function fillZip() {
            // the assumption so far is that all ODF parts are serialized
            // already, but meta, settings, styles and content should be
            // refreshed
            // update the zip entries with the data from the live ODF DOM
            var data,
                date = new Date(),
                settings;

            if (partMimetypes["settings.xml"]) {
                settings = serializeSettingsXml();
                // Optional according to package spec
                // See http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#__RefHeading__440346_826425813
                data = runtime.byteArrayFromString(settings, "utf8");
                zip.save("settings.xml", data, true, date);
            } else {
                zip.remove("settings.xml");
            }
            updateMetadataForSaving();
            // Even thought meta-data is optional, it is always created by the previous statement
            data = runtime.byteArrayFromString(serializeMetaXml(), "utf8");
            zip.save("meta.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeStylesXml(), "utf8");
            zip.save("styles.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeContentXml(), "utf8");
            zip.save("content.xml", data, true, date);
            data = runtime.byteArrayFromString(serializeManifestXml(), "utf8");
            zip.save("META-INF/manifest.xml", data, true, date);
        }
        /**
         * Create a bytearray from the zipfile.
         * @param {!function(!Uint8Array):undefined} successCallback receiving zip as bytearray
         * @param {!function(?string):undefined} errorCallback receiving possible err
         * @return {undefined}
         */
        function createByteArray(successCallback, errorCallback) {
            fillZip();
            zip.createByteArray(successCallback, errorCallback);
        }
        this.createByteArray = createByteArray;
        /**
         * @param {!string} newurl
         * @param {function(?string):undefined} callback
         * @return {undefined}
         */
        function saveAs(newurl, callback) {
            fillZip();
            zip.writeAs(newurl, function (err) {
                callback(err);
            });
        }
        this.saveAs = saveAs;
        /**
         * @param {function(?string):undefined} callback
         * @return {undefined}
         */
        this.save = function (callback) {
            saveAs(url, callback);
        };

        /**
         * @return {!string}
         */
        this.getUrl = function () {
            // TODO: saveAs seems to not update the url, is that wanted?
            return url;
        };
        /**
         * Add a new blob or overwrite any existing blob which has the same filename.
         * @param {!string} filename
         * @param {!string} mimetype
         * @param {!string} content base64 encoded string
         */
        this.setBlob = function (filename, mimetype, content) {
            var data = base64.convertBase64ToByteArray(content),
                date = new Date();
            zip.save(filename, data, false, date);
            if (partMimetypes.hasOwnProperty(filename)) {
                runtime.log(filename + " has been overwritten.");
            }
            partMimetypes[filename] = mimetype;
        };
        /**
         * @param {!string} filename
         */
        this.removeBlob = function (filename) {
            var foundAndRemoved = zip.remove(filename);
            runtime.assert(foundAndRemoved, "file is not found: " + filename);
            delete partMimetypes[filename];
        };
        // initialize public variables
        this.state = OdfContainer.LOADING;
        this.rootElement = /**@type{!ODFDocumentElement}*/(
            createElement({
                Type: ODFDocumentElement,
                namespaceURI: ODFDocumentElement.namespaceURI,
                localName: ODFDocumentElement.localName
            })
        );

        // initialize private variables
        if (urlOrType === OdfContainer.DocumentType.TEXT) {
            zip = createEmptyDocument("text");
        } else if (urlOrType === OdfContainer.DocumentType.TEXT_TEMPLATE) {
            zip = createEmptyDocument("text", true);
        } else if (urlOrType === OdfContainer.DocumentType.PRESENTATION) {
            zip = createEmptyDocument("presentation");
        } else if (urlOrType === OdfContainer.DocumentType.PRESENTATION_TEMPLATE) {
            zip = createEmptyDocument("presentation", true);
        } else if (urlOrType === OdfContainer.DocumentType.SPREADSHEET) {
            zip = createEmptyDocument("spreadsheet");
        } else if (urlOrType === OdfContainer.DocumentType.SPREADSHEET_TEMPLATE) {
            zip = createEmptyDocument("spreadsheet", true);
        } else {
            url = /**@type{!string}*/(urlOrType);
            zip = new Zip(url, function (err, zipobject) {
                zip = zipobject;
                if (err) {
                    loadFromXML(url, function (xmlerr) {
                        if (err) {
                            zip.error = err + "\n" + xmlerr;
                            setState(OdfContainer.INVALID);
                        }
                    });
                } else {
                    loadComponents();
                }
            });
        }
    };
    OdfContainer.EMPTY = 0;
    OdfContainer.LOADING = 1;
    OdfContainer.DONE = 2;
    OdfContainer.INVALID = 3;
    OdfContainer.SAVING = 4;
    OdfContainer.MODIFIED = 5;
    /**
     * @param {!string} url
     * @return {!OdfContainer}
     */
    OdfContainer.getContainer = function (url) {
        return new OdfContainer(url, null);
    };
/**
 * @enum {number}
 */
OdfContainer.DocumentType = {
    TEXT:                  1,
    TEXT_TEMPLATE:         2,
    PRESENTATION:          3,
    PRESENTATION_TEMPLATE: 4,
    SPREADSHEET:           5,
    SPREADSHEET_TEMPLATE:  6
};
/**@const*/
exports.OdfContainer = OdfContainer;
