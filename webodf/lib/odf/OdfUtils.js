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

/*global Node, NodeFilter*/

"use strict";
var odfSchema = require("./OdfSchema");
var Namespaces = require("./Namespaces").Namespaces;
var domUtils = require("../core/DomUtils");

    var /**@const
           @type{!string}*/
        textns = Namespaces.textns,
        /**@const
           @type{!string}*/
        drawns = Namespaces.drawns,
        /**@const
           @type{!string}*/
        xlinkns = Namespaces.xlinkns,
        // only add odf element namespaces here.
        // Namespaces solely used for attributes are excluded. eg. fo, xlink & xml
        odfNodeNamespaceMap = [
            Namespaces.dbns,
            Namespaces.dcns,
            Namespaces.dr3dns,
            Namespaces.drawns,
            Namespaces.chartns,
            Namespaces.formns,
            Namespaces.numberns,
            Namespaces.officens,
            Namespaces.presentationns,
            Namespaces.stylens,
            Namespaces.svgns,
            Namespaces.tablens,
            Namespaces.textns
        ];

    /**
     * Determine if the node is a draw:image element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isImage(e) {
        var name = e && e.localName;
        return name === "image" && e.namespaceURI === drawns;
    }
exports.isImage = isImage;

    /**
     * Determine if the node is a draw:frame element and has its text:anchor-type attribute set to 'as-char'.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isCharacterFrame(e) {
        // TODO the anchor-type can be defined on any style associated with the frame
        return e !== null && e.nodeType === Node.ELEMENT_NODE
            && e.localName === "frame" && e.namespaceURI === drawns
            && /**@type{!Element}*/(e).getAttributeNS(textns, "anchor-type")
                === "as-char";
    }
exports.isCharacterFrame = isCharacterFrame;

    /**
     * Determine if the node is an office:annotation element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isAnnotation(e) {
        var name = e && e.localName;
        return name === "annotation" && e.namespaceURI === Namespaces.officens;
    }

    /**
     * Determine if the node is an annotation wrapper element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isAnnotationWrapper(e) {
        var name = e && e.localName;
        return name === "div" && /**@type{!HTMLDivElement}*/(e).className === "annotationWrapper";
    }

    /**
     * Determine if the node is an inline 'root' type,
     * i.e. an office:annotation or a wrapper for an annotaiton.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isInlineRoot(e) {
        return isAnnotation(e)
            || isAnnotationWrapper(e);
    }
exports.isInlineRoot = isInlineRoot;

    /**
     * Determine if the node is a text:span element.
     * @param {?Node} e
     * @return {!boolean}
     */
exports.isTextSpan = function (e) {
        var name = e && e.localName;
        return name === "span" && e.namespaceURI === textns;
    };

    /**
     * Determine if the node is a text:a element.
     * @param {?Node} node
     * @return {!boolean}
     */
    function isHyperlink(node) {
        var name = node && node.localName;
        return name === "a" && node.namespaceURI === textns;
    }
exports.isHyperlink = isHyperlink;

    /**
     * Gets the href attribute of text:a element
     * @param {!Element} element
     * @return {!string}
     */
exports.getHyperlinkTarget = function (element) {
        return element.getAttributeNS(xlinkns, 'href') || "";
    };

    /**
     * Determine if the node is a text:p or a text:h element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isParagraph(e) {
        var name = e && e.localName;
        return (name === "p" || name === "h") && e.namespaceURI === textns;
    }
exports.isParagraph = isParagraph;

    /**
     * Find the paragraph containing the specified node. If an offset is provided and
     * the node has a child at the specified offset, this will be included in the search
     * as well if the supplied node is not a paragraph itself.
     * @param {?Node} node
     * @param {!number=} offset
     * @return {?Element}
     */
    function getParagraphElement(node, offset) {
        if (node && offset !== undefined && !isParagraph(node) && node.childNodes.item(offset)) {
            node = node.childNodes.item(offset);
        }
        while (node && !isParagraph(node)) {
            node = node.parentNode;
        }
        return /**@type{?Element}*/(node);
    }
exports.getParagraphElement = getParagraphElement;

    /**
     * @param {?Node} node  Node to start searching with
     * @param {!Element} container  Root container to stop searching at.
     * @return {?Element}
     */
    function getParentAnnotation(node, container) {
         while (node && node !== container) {
            if (node.namespaceURI === Namespaces.officens && node.localName === 'annotation') {
                return /**@type{!Element}*/(node);
            }
            node = node.parentNode;
        }
        return null;
    }
exports.getParentAnnotation = getParentAnnotation;

    /**
     * @param {?Node} node  Node to start searching with
     * @param {!Element} container  Root container to stop searching at.
     * @return {!boolean}
     */
exports.isWithinAnnotation = function (node, container) {
        return Boolean(getParentAnnotation(node, container));
    };

    /**
     * Gets the creator of an annotation.
     * @param {!Element} annotationElement
     * @return {!string}
     */
exports.getAnnotationCreator = function (annotationElement) {
        var creatorElement = /**@type{!Element}*/(annotationElement.getElementsByTagNameNS(Namespaces.dcns, "creator")[0]);
        return creatorElement.textContent;
    };

    /**
     * Determine if the node is a text:list-item element.
     * @param {?Node} e
     * @return {!boolean}
     */
exports.isListItem = function (e) {
        var name = e && e.localName;
        return name === "list-item" && e.namespaceURI === textns;
    };

    /**
     * Determine if the node is a text:line-break element.
     * @param {?Node} e
     * @return {!boolean}
     */
exports.isLineBreak = function (e) {
        var name = e && e.localName;
        return name === "line-break" && e.namespaceURI === textns;
    };

    /**
     * Determine if the text consists entirely of whitespace characters.
     * At least one whitespace is required.
     * @param {!string} text
     * @return {!boolean}
     */
    function isODFWhitespace(text) {
        return (/^[ \t\r\n]+$/).test(text);
    }
exports.isODFWhitespace = isODFWhitespace;

    /**
     * Determine if the node is a grouping element.
     * @param {?Node} n
     * @return {!boolean}
     */
    function isGroupingElement(n) {
        if (n === null || n.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        var e = /**@type{!Element}*/(n),
            localName = e.localName;
        return odfSchema.isTextContainer(e.namespaceURI, localName)
               || (localName === "span" && e.className === "webodf-annotationHighlight");
    }
exports.isGroupingElement = isGroupingElement;

    /**
     * @param {?Node} n
     * @return {!boolean}
     */
    function isFieldElement(n) {
        if (n === null || n.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        var e = /**@type{!Element}*/(n),
            localName = e.localName;
        return odfSchema.isField(e.namespaceURI, localName);
    }
exports.isFieldElement = isFieldElement;

    /**
     * Determine if the node is a character element,
     * namely "s", "tab", or "line-break".
     * @param {?Node} e
     * @return {!boolean}
     */
    function isCharacterElement(e) {
        var n = e && e.localName,
            ns,
            r = false;
        if (n) {
            ns = e.namespaceURI;
            if (ns === textns) {
                r = n === "s" || n === "tab" || n === "line-break";
            }
        }
        return r;
    }
exports.isCharacterElement = isCharacterElement;
    /**
     * Determine if the node is an 'as char' type of element,
     * i.e. any element which behaves like a character with
     * respect to it's surrounding positions, such as the
     * space/tab/line-break elements, draw:frames with
     * anchor type being 'as-char', or inline root elements
     * such as annotations.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isAnchoredAsCharacterElement(e) {
        return isCharacterElement(e) || isFieldElement(e) || isCharacterFrame(e) || isInlineRoot(e);
    }
exports.isAnchoredAsCharacterElement = isAnchoredAsCharacterElement;
    /**
     * Determine if the node is a <text:s/> character element.
     * @param {?Node} e
     * @return {!boolean}
     */
    function isSpaceElement(e) {
        var n = e && e.localName,
            ns,
            r = false;
        if (n) {
            ns = e.namespaceURI;
            if (ns === textns) {
                r = n === "s";
            }
        }
        return r;
    }
exports.isSpaceElement = isSpaceElement;

    /**
     * Returns true if the given node is an odf node
     * @param {!Node} node
     * @return {!boolean}
     */
    function isODFNode(node) {
        return odfNodeNamespaceMap.indexOf(node.namespaceURI) !== -1;
    }
exports.isODFNode = isODFNode;

    /**
     * Returns true if the supplied node contains no text-in-ODF, or ODF elements
     * @param {!Node} node
     * @return {!boolean}
     */
    function hasNoODFContent(node) {
        var childNode;
        if (isCharacterElement(node) || isFieldElement(node)) {
            return false;
        }
        if (isGroupingElement(/**@type{!Node}*/(node.parentNode)) && node.nodeType === Node.TEXT_NODE) {
            return node.textContent.length === 0;
        }
        childNode = node.firstChild;
        while (childNode) {
            if (isODFNode(childNode) || !hasNoODFContent(childNode)) {
                return false;
            }
            childNode = childNode.nextSibling;
        }
        return true;
    }
exports.hasNoODFContent= hasNoODFContent;

    /**
     * @param {!Node} node
     * @return {!Node}
     */
    function firstChild(node) {
        while (node.firstChild !== null && isGroupingElement(node)) {
            node = node.firstChild;
        }
        return node;
    }
exports.firstChild = firstChild;
    /**
     * @param {!Node} node
     * @return {!Node}
     */
    function lastChild(node) {
        while (node.lastChild !== null && isGroupingElement(node)) {
            node = node.lastChild;
        }
        return node;
    }
exports.lastChild = lastChild;
    /**
     * @param {!Node} node
     * @return {?Node}
     */
    function previousNode(node) {
        while (!isParagraph(node) && node.previousSibling === null) {
            node = /**@type{!Node}*/(node.parentNode);
        }
        return isParagraph(node) ? null : lastChild(/**@type{!Node}*/(node.previousSibling));
    }
exports.previousNode = previousNode;
    /**
     * @param {!Node} node
     * @return {?Node}
     */
    function nextNode(node) {
        while (!isParagraph(node) && node.nextSibling === null) {
            node = /**@type{!Node}*/(node.parentNode);
        }
        return isParagraph(node) ? null : firstChild(/**@type{!Node}*/(node.nextSibling));
    }
exports.nextNode = nextNode;

    /**
     * Walk to the left along the DOM and return true if the first thing
     * encountered is either a non-whitespace text character or a non-space
     * character element (i.e., any character element other than <text:s/>).
     * Walking goes through grouping elements.
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function scanLeftForNonSpace(node) {
        var r = false,
            text;
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                text = /**@type{!Text}*/(node);
                if (text.length === 0) {
                    node = previousNode(text);
                } else {
                    return !isODFWhitespace(
                        text.data.substr(text.length - 1, 1)
                    );
                }
            } else if (isAnchoredAsCharacterElement(node)) {
                r = isSpaceElement(node) === false;
                node = null;
            } else {
                node = previousNode(node);
            }
        }
        return r;
    }
exports.scanLeftForNonSpace = scanLeftForNonSpace;
    /**
     * Walk to the left along the DOM and return the type of the first
     * thing encountered.
     * 0 none of the below
     * 1 non-whitespace character or a character element
     * 2 whitespace character that is preceded by a non-whitespace character
     *   or a character element
     *
     * @param {!Node} node the first node to scan
     * @return {!number}
     */
    function lookLeftForCharacter(node) {
        var text, r = 0, tl = 0;
        if (node.nodeType === Node.TEXT_NODE) {
            tl = /**@type{!Text}*/(node).length;
        }
        if (tl > 0) {
            text = /**@type{!Text}*/(node).data;
            if (!isODFWhitespace(text.substr(tl - 1, 1))) {
                r = 1; // character found
            } else if (tl === 1) {
                r = scanLeftForNonSpace(previousNode(node)) ? 2 : 0;
            } else {
                r = isODFWhitespace(text.substr(tl - 2, 1)) ? 0 : 2;
            }
        } else if (isAnchoredAsCharacterElement(node)) {
            r = 1;
        }
        return r;
    }
exports.lookLeftForCharacter = lookLeftForCharacter;
    /**
     * Look to the right along the DOM and return true if the first thing
     * encountered is either a non-whitespace character or a character
     * element.
     *
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function lookRightForCharacter(node) {
        var r = false,
            l = 0;
        if (node && node.nodeType === Node.TEXT_NODE) {
            l = /**@type{!Text}*/(node).length;
        }
        if (l > 0) {
            r = !isODFWhitespace(/**@type{!Text}*/(node).data.substr(0, 1));
        } else if (isAnchoredAsCharacterElement(node)) {
            r = true;
        }
        return r;
    }
exports.lookRightForCharacter = lookRightForCharacter;
    /**
     * Walk to the left along the DOM and return true if either a
     * non-whitespace character or a character element is encountered.
     *
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function scanLeftForAnyCharacter(node) {
        var r = false, l;
        node = node && lastChild(node);
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                l = /**@type{!Text}*/(node).length;
            } else {
                l = 0;
            }
            if (l > 0 && !isODFWhitespace(/**@type{!Text}*/(node).data)) {
                r = true;
                break;
            }
            if (isAnchoredAsCharacterElement(node)) {
                r = true;
                break;
            }
            node = previousNode(node);
        }
        return r;
    }
exports.scanLeftForAnyCharacter = scanLeftForAnyCharacter;
    /**
     * Walk to the right along the DOM and return true if either a
     * non-whitespace character or a character element is encountered.
     *
     * @param {?Node} node the first node to scan
     * @return {!boolean}
     */
    function scanRightForAnyCharacter(node) {
        var r = false, l;
        node = node && firstChild(node);
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                l = /**@type{!Text}*/(node).length;
            } else {
                l = 0;
            }
            if (l > 0 && !isODFWhitespace(/**@type{!Text}*/(node).data)) {
                r = true;
                break;
            }
            if (isAnchoredAsCharacterElement(node)) {
                r = true;
                break;
            }
            node = nextNode(node);
        }
        return r;
    }
exports.scanRightForAnyCharacter = scanRightForAnyCharacter;

    /**
     * check if the node is part of the trailing whitespace
     * @param {!Text} textnode
     * @param {!number} offset
     * @return {!boolean}
     */
    function isTrailingWhitespace(textnode, offset) {
        if (!isODFWhitespace(textnode.data.substr(offset))) {
            return false;
        }
        return !scanRightForAnyCharacter(nextNode(textnode));
    }
exports.isTrailingWhitespace = isTrailingWhitespace;

    /**
     * Takes a textNode and an offset, and returns true if the character
     * at that offset is a significant whitespace.
     *
     * Significant whitespace is defined as:
     * - Not part of the leading whitespace block in a paragraph
     * - Not part of the trailing whitespace block in a paragraph
     * - The first whitespace character after a text node or character
     *
     * All other whitespace elements are considered insignificant
     * @param {!Text} textNode
     * @param {!number} offset
     * @return {!boolean}
     */
    function isSignificantWhitespace(textNode, offset) {
        var text = textNode.data,
            result;

        if (!isODFWhitespace(text[offset])) {
            // Character is not whitespace
            return false;
        }

        if (isAnchoredAsCharacterElement(textNode.parentNode)) {
            // Parent is a character element, and therefore does not actually contain text
            // This prevents a space element from being upgraded again
            return false;
        }

        if (offset > 0) {
            if (!isODFWhitespace(text[offset - 1])) {
                // First whitespace after a character is significant
                result = true;
            }
        } else if (scanLeftForNonSpace(previousNode(textNode))) {
            // If the first character found scanning to the left is non-whitespace, this might still be significant
            result = true;
        }

        if (result === true) {
            return isTrailingWhitespace(textNode, offset)
                ? false : true;
        }
        return false;
    }
exports.isSignificantWhitespace = isSignificantWhitespace;

    /**
     * Returns true if the supplied node is a downgradeable space element.
     * As per http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-text_s
     * a downgradeable whitespace element is a space element that is immediately preceded by something other than a space
     * and has at least one non-space character after it
     * @param {!Node} node
     * @return {!boolean}
     */
exports.isDowngradableSpaceElement = function(node) {
        if (isSpaceElement(node)) {
            return scanLeftForNonSpace(previousNode(node)) && scanRightForAnyCharacter(nextNode(node));
        }
        return false;
    };

    /**
     * Returns the length split as value and unit, from an ODF attribute
     * @param {?string|undefined} length
     * @return {?{value:!number,unit:!string}}
     */
    function parseLength(length) {
        var re = /(-?[0-9]*[0-9][0-9]*(\.[0-9]*)?|0+\.[0-9]*[1-9][0-9]*|\.[0-9]*[1-9][0-9]*)((cm)|(mm)|(in)|(pt)|(pc)|(px)|(%))/,
            m = re.exec(length);
        if (!m) {
            return null;
        }
        return {value: parseFloat(m[1]), unit: m[3]};
    }
exports.parseLength = parseLength;

    /**
     * Returns the value and unit of the length, if it is positive ( > 0)
     * @param {?string|undefined} length
     * @return {?{value:!number,unit:!string}}
     */
    function parsePositiveLength(length) {
        var result = parseLength(length);
        if (result && (result.value <= 0 || result.unit === '%')) {
            return null;
        }
        return result;
    }

    /**
     * Returns the value and unit of the length, if it is non-negative ( >= 0)
     * @param {?string|undefined} length
     * @return {?{value:!number,unit:!string}}
     */
    function parseNonNegativeLength(length) {
        var result = parseLength(length);
        if (result && (result.value < 0 || result.unit === '%')) {
            return null;
        }
        return result;
    }
exports.parseNonNegativeLength = parseNonNegativeLength;

    /**
     * Returns the value and unit(%) of the length, if it is specified in %age
     * @param {?string|undefined} length
     * @return {?{value:!number,unit:!string}}
     */
    function parsePercentage(length) {
        var result = parseLength(length);
        if (result && (result.unit !== '%')) {
            return null;
        }
        return result;
    }

    /**
     * Returns the value and unit of the font size, in conformance with fo:font-size
     * constraints
     * @param {?string|undefined} fontSize
     * @return {?{value:!number,unit:!string}}
     */
    function parseFoFontSize(fontSize) {
        return parsePositiveLength(fontSize) || parsePercentage(fontSize);
    }
exports.parseFoFontSize = parseFoFontSize;

    /**
     * Returns the value and unit of the line height, in conformance with fo:line-height
     * constraints
     * @param {?string|undefined} lineHeight
     * @return {?{value:!number,unit:!string}}
     */
    function parseFoLineHeight(lineHeight) {
        return parseNonNegativeLength(lineHeight) || parsePercentage(lineHeight);
    }
exports.parseFoLineHeight = parseFoLineHeight;

    /**
     * Adapted from instructions on how to generate plain text from an ODT document.
     * See algorithm at http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#__RefHeading__1415196_253892949
     * @param {!Node} node
     * @return {boolean}
     */
    function isTextContentContainingNode(node) {
        switch (node.namespaceURI) {
            // Namespace skips
        case Namespaces.drawns:
        case Namespaces.svgns:
        case Namespaces.dr3dns:
            return false;
        case Namespaces.textns:
            // Specific node type skips
            //noinspection FallthroughInSwitchStatementJS
            switch (node.localName) {
            case 'note-body':
            case 'ruby-text':
                return false;
            }
            break;
        case Namespaces.officens:
            // Specific node type skips
            //noinspection FallthroughInSwitchStatementJS
            switch (node.localName) {
            case 'annotation':
            case 'binary-data':
            case 'event-listeners':
                return false;
            }
            break;
        default:
            // Skip webodf edit markers or cursor information
            switch (node.localName) {
            case 'cursor':
            case 'editinfo':
                return false;
            }
            break;
        }
        return true;
    }
exports.isTextContentContainingNode = isTextContentContainingNode;

    /**
     * Returns true if the text node is within a paragraph and contains either non-whitespace characters, or
     * significant whitespace characters (as defined by the ODF standards).
     * WARNING this method is likely to be quite slow, so should be used as little as possible
     * @param {!Text} textNode
     * @return {!boolean}
     */
    function isSignificantTextContent(textNode) {
        return Boolean(getParagraphElement(textNode)
            && (!isODFWhitespace(textNode.textContent) || isSignificantWhitespace(textNode, 0)));
    }

    /**
     * Remove any nodes that aren't fully contained within the supplied range. This function assumes
     * the nodes appear in document order.
     * @param {!Range} range
     * @param {!Array.<!Node>} nodes
     * @return {undefined}
     */
    function removePartiallyContainedNodes(range, nodes) {
        while (nodes.length > 0 && !domUtils.rangeContainsNode(range, /**@type{!Node}*/(nodes[0]))) {
            nodes.shift();
        }
        while (nodes.length > 0 && !domUtils.rangeContainsNode(range, /**@type{!Node}*/(nodes[nodes.length - 1]))) {
            nodes.pop();
        }
    }

    /**
     * Returns a array of text nodes considered to be part of the supplied range.
     * This will exclude elements that are not part of the ODT main text body,
     * as well as insignificant whitespace text nodes.
     * @param {!Range} range    Range to search for nodes within
     * @param {boolean} includePartial Include partially intersecting text nodes
     *                                 in the result.
     * @return {!Array.<!Node>}
     */
    function getTextNodes(range, includePartial) {
        var textNodes;

        /**
         * @param {!Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            var result = NodeFilter.FILTER_REJECT;
            if (node.nodeType === Node.TEXT_NODE) {
                if (isSignificantTextContent(/**@type{!Text}*/(node))) {
                    result = NodeFilter.FILTER_ACCEPT;
                }
            } else if (isTextContentContainingNode(node)) {
                result = NodeFilter.FILTER_SKIP;
            }
            return result;
        }

        /*jslint bitwise:true*/
        textNodes = domUtils.getNodesInRange(range, nodeFilter, NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
        /*jslint bitwise:false*/
        if (!includePartial) {
            removePartiallyContainedNodes(range, textNodes);
        }

        return textNodes;
    }
exports.getTextNodes = getTextNodes;

    /**
     * Get all character elements and text nodes fully contained within the
     * supplied range in document order.
     *
     * For example, given the following fragment, with the range starting at b,
     * and ending at c:
     *      <text:p>ab<text:s/>cd</text:p>
     * this function would return the following array:
     *      ["b", text:s, "c"]
     * @param {!Range} range
     * @param {!boolean} includePartial Include partially intersecting text &
     *                         character nodes in the result.
     * @param {!boolean} includeInsignificantWhitespace Include whitespace only
     *                         nodes that are not considered significant text
     *                         content. This includes whitespace only elements
     *                         used in pretty-formatted xml as LibreOffice
     *                         produces in flat ODT files.
     * @return {!Array.<!Element|!Text>}
     */
    function getTextElements(range, includePartial, includeInsignificantWhitespace) {
        var elements;

        /**
         * @param {!Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            var result = NodeFilter.FILTER_REJECT;
            // do not return anything inside an character element or an inline root such as an annotation
            if (isCharacterElement(node.parentNode) || isFieldElement(node.parentNode) || isInlineRoot(node)) {
                result = NodeFilter.FILTER_REJECT;
            } else if (node.nodeType === Node.TEXT_NODE) {
                if (includeInsignificantWhitespace || isSignificantTextContent(/**@type{!Text}*/(node))) {
                        // Text nodes should only be returned if they are
                        // fully contained within the range.
                    result = NodeFilter.FILTER_ACCEPT;
                }
            } else if (isAnchoredAsCharacterElement(node)) {
                // Character elements should only be returned if they are
                // fully contained within the range.
                result =  NodeFilter.FILTER_ACCEPT;
            } else if (isTextContentContainingNode(node) || isGroupingElement(node)) {
                result =  NodeFilter.FILTER_SKIP;
            }
            return result;
        }

        /*jslint bitwise:true*/
        elements = domUtils.getNodesInRange(range, nodeFilter, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        /*jslint bitwise:false*/
        if (!includePartial) {
            removePartiallyContainedNodes(range, elements);
        }

        return elements;
    }
exports.getTextElements = getTextElements;

    /**
     * Crawl parent nodes starting at the startContainer until a matching node is found,
     * or the first inline root is met. If a node is accepted by the supplied filter, and is
     * not already the first element in the elements array, this node is prepended to the start
     * of the elements array.
     *
     * @param {!Node} startContainer Container to start search from (inclusive)
     * @param {!Array.<!Node>} elements Existing elements already discovered
     * @param {!function(!Node):!boolean} filter
     */
    function prependParentContainers(startContainer, elements, filter) {
        var container = startContainer;
        while (container) {
            if (filter(container)) {
                if (elements[0] !== container) {
                    elements.unshift(container);
                }
                break;
            }
            if (isInlineRoot(container)) {
                break;
            }
            container = container.parentNode;
        }
    }

    /**
     * Get all paragraph elements that intersect the supplied range in document
     * order.
     *
     * For example, given the following fragment, with the range starting at b,
     * and ending at c:
     *      <text:p id="A">ab</text:p><text:p id="B"><text:s/>cd</text:p>
     * this function would return the following array:
     *      [text:p{id="A"}, text:p{id="B"}]
     * @param {!Range} range
     * @return {!Array.<!Element>}
     */
exports.getParagraphElements = function (range) {
        var elements;
        /**
         * @param {!Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            var result = NodeFilter.FILTER_REJECT;
            if (isParagraph(node)) {
                result = NodeFilter.FILTER_ACCEPT;
            } else if (isTextContentContainingNode(node) || isGroupingElement(node)) {
                result = NodeFilter.FILTER_SKIP;
            }
            return result;
        }

        elements = domUtils.getNodesInRange(range, nodeFilter, NodeFilter.SHOW_ELEMENT);
        // getNodesInRange will only return nodes it enters during the iteration.
        // However, we desire all paragraph nodes either contained OR containing this range,
        // so we crawl the parentNodes of the start container until a root is found.

        // Note, this isn't necessary for the end container because iteration crosses the
        // node boundary when entering towards the end container, meaning all paragraphs in
        // the end container's parentNodes will be reported by getNodesInRange.
        prependParentContainers(/**@type{!Node}*/(range.startContainer), elements, isParagraph);
        return elements;
    };

    /**
     * Get all image elements that fully contained within the supplied range in
     * document order.
     * @param {!Range} range
     * @return {!Array.<Node>}
     */
exports.getImageElements = function (range) {
        var elements;

        /**
         * @param {!Node} node
         * @return {number}
         */
        function nodeFilter(node) {
            var result = NodeFilter.FILTER_SKIP;
            if (isImage(node)) {
                result = NodeFilter.FILTER_ACCEPT;
            }
            return result;
        }

        elements = domUtils.getNodesInRange(range, nodeFilter, NodeFilter.SHOW_ELEMENT);
        // See description in getParagraphElements as to why this is necessary
        // Short summary: want to include images that completely contain this range
        prependParentContainers(/**@type{!Node}*/(range.startContainer), elements, isImage);
        return elements;
    };

    /**
     * Returns the node right after the given point.
     * @param {!Node} container
     * @param {!number} offset
     * @return {!Node}
     */
    function getRightNode(container, offset) {
        var node = container;
        if (offset < node.childNodes.length - 1) {
            node = /** @type {!Node} */(node.childNodes[offset + 1]);
        } else {
            while (!node.nextSibling) {
                node = node.parentNode;
            }
            node = node.nextSibling;
        }
        while (node.firstChild) {
            node = node.firstChild;
        }
        return node;
    }

    /**
     * Get all hyperlink elements that intersect the supplied range in document order
     *
     * For example, given the following fragment, with the range starting at b, and ending at c:
     *      <text:a xlink:href="google">ab</text:a><text:a xlink:href="apple">cd</text:a>
     * this function would return the following array:
     *      [text:a{xlink:href="google"}, text:a{xlink:href="apple"}]
     * @param {!Range} range
     * @return {!Array.<Node>}
     */
exports.getHyperlinkElements = function (range) {
        var links = [],
            newRange = /** @type {!Range}*/(range.cloneRange()),
            node,
            textNodes;

        if (range.collapsed && range.endContainer.nodeType === Node.ELEMENT_NODE) {
            node = getRightNode(range.endContainer, range.endOffset);
            if (node.nodeType === Node.TEXT_NODE) {
                newRange.setEnd(node, 1);
            }
        }

        textNodes = getTextElements(newRange, true, false);
        textNodes.forEach(function (node) {
            var parent = node.parentNode;
            while (!isParagraph(parent)) {
                if (isHyperlink(parent) && links.indexOf(parent) === -1) {
                    links.push(parent);
                    break;
                }
                parent = parent.parentNode;
            }
        });
        newRange.detach();
        return links;
    };

    /**
     * Normalize the font-family name as defined in
     * http://www.w3.org/TR/2008/REC-CSS2-20080411/fonts.html#propdef-font-family
     * (see there text behind: "There are two types of font family names: <family-name>")
     * @param {!string} fontFamilyName
     * @return {!string}
     */
    /*jslint regexp: true*/
exports.getNormalizedFontFamilyName = function(fontFamilyName) {
        // not quoted with either single- or double-quotes?
        // (\n & \r are syntactically okay as whitespaces, so need to be accepted as well)
        //     ^(["'])        -> match either " or ' at begin (and store match)
        //     (?:.|[\n\r])*? -> match non-greedy any number of any char or \r and \n
        //     \1$            -> match content of first match at end
        if (!(/^(["'])(?:.|[\n\r])*?\1$/).test(fontFamilyName)) {
            // remove any whitespaces at begin and end of full name (ignore internal yet)
            //     ^[ \t\r\n\f]*    -> match whitespace at begin
            //     ((?:.|[\n\r])*?) -> match non-greedy any number of any char or \r and \n (and store match)
            //     [ \t\r\n\f]*$    -> match whitespace at end
            fontFamilyName = fontFamilyName.replace(/^[ \t\r\n\f]*((?:.|[\n\r])*?)[ \t\r\n\f]*$/, "$1");
            // if there is any internal whitespace, reduce it to just one normal whitespace per group
            // and add quotes around the full name
            // (quotes should be only added if there is whitespace inside, as the passed fontFamilyName could
            // be a generic-family one, which must not be quoted)
            if ((/[ \t\r\n\f]/).test(fontFamilyName)) {
                fontFamilyName = "'" + fontFamilyName.replace(/[ \t\r\n\f]+/g, " ") + "'";
            }
        }
        return fontFamilyName;
    };
    /*jslint regexp: false*/
