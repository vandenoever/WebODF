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
var runtime = require("../runtime").runtime;
var domUtils = require("../core/DomUtils");
var Formatting = require("../odf/Formatting").Formatting;
var Member = require("./Member").Member;
var Canvas = require("./Canvas").Canvas;
var OpsDocument = require("./Document").Document;
var OdfCanvas = require("../odf/OdfCanvas").OdfCanvas;
var PositionFilter = require("../core/PositionFilter").PositionFilter;
var TextPositionFilter = require("./TextPositionFilter").TextPositionFilter;
var task = require("../core/Task");
var OdtStepsTranslator = require("./OdtStepsTranslator").OdtStepsTranslator;
var Operation = require("./Operation").Operation;
var Destroyable = require("../core/Destroyable").Destroyable;
var StepIterator = require("../core/StepIterator").StepIterator;
var stepUtils = require("../odf/StepUtils");
var OdtCursor = require("./OdtCursor").OdtCursor;
var odfUtils = require("../odf/OdfUtils");
var EventNotifier = require("../core/EventNotifier").EventNotifier;
var Namespaces = require("../odf/Namespaces").Namespaces;
var StepDirection = require("../core/enums").StepDirection;
var OdfTextBodyNodeFilter = require("../gui/OdfTextBodyNodeFilter").OdfTextBodyNodeFilter;
var NodeFilterChain = require("../core/NodeFilterChain").NodeFilterChain;
var PositionIterator = require("../core/PositionIterator").PositionIterator;
var PositionFilterChain = require("../core/PositionFilterChain").PositionFilterChain;
var BlacklistNamespaceNodeFilter = require("../gui/BlacklistNamespaceNodeFilter").BlacklistNamespaceNodeFilter;

    /**
     * A filter that allows a position if it has the same closest
     * whitelisted root as the specified 'anchor', which can be the cursor
     * of the given memberid, or a given node
     * @constructor
     * @implements {PositionFilter}
     * @param {!string|!Node} anchor
     * @param {Object.<!OdtCursor>} cursors
     * @param {function(!Node):!Node} getRoot
     */
    function RootFilter(anchor, cursors, getRoot) {
        "use strict";
        var /**@const*/
        FILTER_ACCEPT = PositionFilter.FilterResult.FILTER_ACCEPT,
        /**@const*/
        FILTER_REJECT = PositionFilter.FilterResult.FILTER_REJECT;

        /**
         * @param {!PositionIterator} iterator
         * @return {!PositionFilter.FilterResult}
         */
        this.acceptPosition = function (iterator) {
            var node = iterator.container(),
                anchorNode;

            if (typeof anchor === "string") {
                anchorNode = cursors[anchor].getNode();
            } else {
                anchorNode = anchor;
            }

            if (getRoot(node) === getRoot(anchorNode)) {
                return FILTER_ACCEPT;
            }
            return FILTER_REJECT;
        };
    }

/**
 * A document that keeps all data related to the mapped document.
 * @constructor
 * @implements {OpsDocument}
 * @implements {Destroyable}
 * @param {!OdfCanvas} odfCanvas
 */
function OdtDocument(odfCanvas) {
    "use strict";

    var self = this,
        /**!Object.<!OdtCursor>*/
        cursors = {},
        /**!Object.<!Member>*/
        members = {},
        eventNotifier = new EventNotifier([
            OpsDocument.signalMemberAdded,
            OpsDocument.signalMemberUpdated,
            OpsDocument.signalMemberRemoved,
            OpsDocument.signalCursorAdded,
            OpsDocument.signalCursorRemoved,
            OpsDocument.signalCursorMoved,
            OdtDocument.signalParagraphChanged,
            OdtDocument.signalParagraphStyleModified,
            OdtDocument.signalCommonStyleCreated,
            OdtDocument.signalCommonStyleDeleted,
            OdtDocument.signalTableAdded,
            OdtDocument.signalOperationStart,
            OdtDocument.signalOperationEnd,
            OdtDocument.signalProcessingBatchStart,
            OdtDocument.signalProcessingBatchEnd,
            OdtDocument.signalUndoStackChanged,
            OdtDocument.signalStepsInserted,
            OdtDocument.signalStepsRemoved,
            OdtDocument.signalMetadataUpdated,
            OdtDocument.signalAnnotationAdded
        ]),
        /**@const*/
        NEXT = StepDirection.NEXT,
        filter,
        /**@type{!OdtStepsTranslator}*/
        stepsTranslator,
        lastEditingOp,
        unsupportedMetadataRemoved = false,
        /**@const*/ SHOW_ALL = NodeFilter.SHOW_ALL,
        blacklistedNodes = new BlacklistNamespaceNodeFilter(["urn:webodf:names:cursor", "urn:webodf:names:editinfo"]),
        odfTextBodyFilter = new OdfTextBodyNodeFilter(),
        defaultNodeFilter = new NodeFilterChain([blacklistedNodes, odfTextBodyFilter]);

    /**
     *
     * @param {!Node} rootNode
     * @return {!PositionIterator}
     */
    function createPositionIterator(rootNode) {
        return new PositionIterator(rootNode, SHOW_ALL, defaultNodeFilter, false);
    }
    this.createPositionIterator = createPositionIterator;

    /**
     * Return the office:text element of this document.
     * @return {!Element}
     */
    function getRootNode() {
        var element = odfCanvas.odfContainer().getContentElement(),
            localName = element && element.localName;
        runtime.assert(localName === "text", "Unsupported content element type '" + localName + "' for OdtDocument");
        return element;
    }
    /**
     * Return the office:document element of this document.
     * @return {!Element}
     */
    this.getDocumentElement = function () {
        return odfCanvas.odfContainer().rootElement;
    };

    this.cloneDocumentElement = function () {
        var rootElement = self.getDocumentElement(),
            annotationViewManager = odfCanvas.getAnnotationViewManager(),
            initialDoc;

        if (annotationViewManager) {
            annotationViewManager.forgetAnnotations();
        }
        initialDoc = rootElement.cloneNode(true);
        odfCanvas.refreshAnnotations();
        // workaround AnnotationViewManager not fixing up cursor positions after creating the highlighting
        self.fixCursorPositions();
        return initialDoc;
    };

    /**
     * @param {!Element} documentElement
     */
    this.setDocumentElement = function (documentElement) {
        var odfContainer = odfCanvas.odfContainer(),
            rootNode;

        eventNotifier.unsubscribe(OdtDocument.signalStepsInserted, stepsTranslator.handleStepsInserted);
        eventNotifier.unsubscribe(OdtDocument.signalStepsRemoved, stepsTranslator.handleStepsRemoved);

        // TODO Replace with a neater hack for reloading the Odt tree
        // Once this is fixed, SelectionView.addOverlays can be removed
        odfContainer.setRootElement(documentElement);
        odfCanvas.setOdfContainer(odfContainer, true);
        odfCanvas.refreshCSS();
        rootNode = getRootNode();
        stepsTranslator = new OdtStepsTranslator(rootNode, createPositionIterator(rootNode), filter, 500);
        eventNotifier.subscribe(OdtDocument.signalStepsInserted, stepsTranslator.handleStepsInserted);
        eventNotifier.subscribe(OdtDocument.signalStepsRemoved, stepsTranslator.handleStepsRemoved);
    };

    /**
     * @return {!Document}
     */
    function getDOMDocument() {
        return /**@type{!Document}*/(self.getDocumentElement().ownerDocument);
    }
    this.getDOMDocument = getDOMDocument;

    /**
     * @param {!Node} node
     * @return {!boolean}
     */
    function isRoot(node) {
        if ((node.namespaceURI === Namespaces.officens
             && node.localName === 'text'
            ) || (node.namespaceURI === Namespaces.officens
                  && node.localName === 'annotation')) {
            return true;
        }
        return false;
    }

    /**
     * @param {!Node} node
     * @return {!Node}
     */
    function getRoot(node) {
        while (node && !isRoot(node)) {
            node = /**@type{!Node}*/(node.parentNode);
        }
        return node;
    }
    this.getRootElement = getRoot;

    /**
     * Create a new StepIterator instance set to the defined position
     *
     * @param {!Node} container
     * @param {!number} offset
     * @param {!Array.<!PositionFilter>} filters Filter to apply to the iterator positions. If multiple
     *  iterators are provided, they will be combined in order using a PositionFilterChain.
     * @param {!Node} subTree Subtree to search for step within. Generally a paragraph or document root. Choosing
     *  a smaller subtree allows iteration to end quickly if there are no walkable steps remaining in a particular
     *  direction. This can vastly improve performance.
     *
     * @return {!StepIterator}
     */
    function createStepIterator(container, offset, filters, subTree) {
        var positionIterator = createPositionIterator(subTree),
            filterOrChain,
            stepIterator;

        if (filters.length === 1) {
            filterOrChain = filters[0];
        } else {
            filterOrChain = new PositionFilterChain();
            filters.forEach(filterOrChain.addFilter);
        }

        stepIterator = new StepIterator(filterOrChain, positionIterator);
        stepIterator.setPosition(container, offset);
        return stepIterator;
    }
    this.createStepIterator = createStepIterator;

    /**
     * Returns a PositionIterator instance at the
     * specified starting position
     * @param {!number} position
     * @return {!PositionIterator}
     */
    function getIteratorAtPosition(position) {
        var iterator = createPositionIterator(getRootNode()),
            point = stepsTranslator.convertStepsToDomPoint(position);

        iterator.setUnfilteredPosition(point.node, point.offset);
        return iterator;
    }
    this.getIteratorAtPosition = getIteratorAtPosition;

    /**
     * Converts the requested step number from root into the equivalent DOM node & offset
     * pair. If the step is outside the bounds of the document, a RangeError will be thrown.
     * @param {!number} step
     * @return {!{node: !Node, offset: !number}}
     */
    this.convertCursorStepToDomPoint = function (step) {
        return stepsTranslator.convertStepsToDomPoint(step);
    };

    /**
     * Rounds to the first step within the paragraph
     * @param {!StepDirection} step
     * @return {!boolean}
     */
    function roundUp(step) {
        return step === NEXT;
    }

    /**
     * Converts a DOM node and offset pair to a cursor step. If a rounding direction is not supplied then
     * the default is to round down to the previous step.
     * @param {!Node} node
     * @param {!number} offset
     * @param {StepDirection=} roundDirection Whether to round down to the previous step or round up
     * to the next step. The default value if unspecified is StepDirection.PREVIOUS
     * @return {!number}
     */
    this.convertDomPointToCursorStep = function (node, offset, roundDirection) {
        var roundingFunc;
        if(roundDirection === NEXT) {
            roundingFunc = roundUp;
        }

        return stepsTranslator.convertDomPointToSteps(node, offset, roundingFunc);
    };

    /**
     * @param {!{anchorNode: !Node, anchorOffset: !number, focusNode: !Node, focusOffset: !number}} selection
     * @return {!{position: !number, length: number}}
     */
    this.convertDomToCursorRange = function (selection) {
        var point1,
            point2;

        point1 = stepsTranslator.convertDomPointToSteps(selection.anchorNode, selection.anchorOffset);
        if (selection.anchorNode === selection.focusNode && selection.anchorOffset === selection.focusOffset) {
            point2 = point1;
        } else {
            point2 = stepsTranslator.convertDomPointToSteps(selection.focusNode, selection.focusOffset);
        }

        return {
            position: point1,
            length: point2 - point1
        };
    };

    /**
     * Convert a cursor range to a DOM range
     * @param {!number} position
     * @param {!number} length
     * @return {!Range}
     */
    this.convertCursorToDomRange = function (position, length) {
        var range = getDOMDocument().createRange(),
            point1,
            point2;

        point1 = stepsTranslator.convertStepsToDomPoint(position);
        if (length) {
            point2 = stepsTranslator.convertStepsToDomPoint(position + length);
            if (length > 0) {
                range.setStart(point1.node, point1.offset);
                range.setEnd(point2.node, point2.offset);
            } else {
                range.setStart(point2.node, point2.offset);
                range.setEnd(point1.node, point1.offset);
            }
        } else {
            range.setStart(point1.node, point1.offset);
        }
        return range;
    };

    /**
     * This function will iterate through positions allowed by the position
     * iterator and count only the text positions. When the amount defined by
     * offset has been counted, the Text node that that position is returned
     * as well as the offset in that text node.
     * Optionally takes a memberid of a cursor, to specifically return the
     * text node positioned just behind that cursor.
     * @param {!number} steps
     * @param {!string=} memberid
     * @return {?{textNode: !Text, offset: !number}}
     */
    function getTextNodeAtStep(steps, memberid) {
        var iterator = getIteratorAtPosition(steps),
            node = iterator.container(),
            lastTextNode,
            nodeOffset = 0,
            cursorNode = null,
            text;

        if (node.nodeType === Node.TEXT_NODE) {
            // Iterator has stopped within an existing text node, to put that up as a possible target node
            lastTextNode = /**@type{!Text}*/(node);
            nodeOffset = /**@type{!number}*/(iterator.unfilteredDomOffset());
            // Always cut in a new empty text node at the requested position.
            // If this proves to be unnecessary, it will be cleaned up just before the return
            // after all necessary cursor rearrangements have been performed
            if (lastTextNode.length > 0) {
                // The node + offset returned make up the boundary just to the right of the requested step
                if (nodeOffset > 0) {
                    // In this case, after the split, the right of the requested step is just after the new node
                    lastTextNode = lastTextNode.splitText(nodeOffset);
                }
                lastTextNode.parentNode.insertBefore(getDOMDocument().createTextNode(""), lastTextNode);
                lastTextNode = /**@type{!Text}*/(lastTextNode.previousSibling);
                nodeOffset = 0;
            }
        } else {
            // There is no text node at the current position, so insert a new one at the current position
            lastTextNode = getDOMDocument().createTextNode("");
            nodeOffset = 0;
            node.insertBefore(lastTextNode, iterator.rightNode());
        }

        if (memberid) {
            // DEPRECATED: This branch is no longer the recommended way of handling cursor movements DO NOT USE
            // If the member cursor is as the requested position
            if (cursors[memberid] && self.getCursorPosition(memberid) === steps) {
                cursorNode = cursors[memberid].getNode();
                // Then move the member's cursor after all adjacent cursors
                while (cursorNode.nextSibling && cursorNode.nextSibling.localName === "cursor") {
                    // TODO this re-arrange logic will break if there are non-cursor elements in the way
                    // E.g., cursors occupy the same "step", but are on different sides of a span boundary
                    // This is currently avoided by calling fixCursorPositions after (almost) every op
                    // to re-arrange cursors together again
                    cursorNode.parentNode.insertBefore(cursorNode.nextSibling, cursorNode);
                }
                if (lastTextNode.length > 0 && lastTextNode.nextSibling !== cursorNode) {
                    // The last text node contains content but is not adjacent to the cursor
                    // This can't be moved, as moving it would move the text content around as well. Yikes!
                    // So, create a new text node to insert data into
                    lastTextNode = getDOMDocument().createTextNode('');
                    nodeOffset = 0;
                }
                // Keep the destination text node right next to the member's cursor, so inserted text pushes the cursor over
                cursorNode.parentNode.insertBefore(lastTextNode, cursorNode);
            }
        } else {
            // Move all cursors BEFORE the new text node. Any cursors occupying the requested position should not
            // move when new text is added in the position
            while (lastTextNode.nextSibling && lastTextNode.nextSibling.localName === "cursor") {
                // TODO this re-arrange logic will break if there are non-cursor elements in the way
                // E.g., cursors occupy the same "step", but are on different sides of a span boundary
                // This is currently avoided by calling fixCursorPositions after (almost) every op
                // to re-arrange cursors together again
                lastTextNode.parentNode.insertBefore(lastTextNode.nextSibling, lastTextNode);
            }
        }

        // After the above cursor adjustments, if the lastTextNode
        // has a text node previousSibling, merge them and make the result the lastTextNode
        while (lastTextNode.previousSibling && lastTextNode.previousSibling.nodeType === Node.TEXT_NODE) {
            text = /**@type{!Text}*/(lastTextNode.previousSibling);
            text.appendData(lastTextNode.data);
            nodeOffset = text.length;
            lastTextNode = text;
            lastTextNode.parentNode.removeChild(lastTextNode.nextSibling);
        }

        // Empty text nodes can be left on either side of the split operations that have occurred
        while (lastTextNode.nextSibling && lastTextNode.nextSibling.nodeType === Node.TEXT_NODE) {
            text = /**@type{!Text}*/(lastTextNode.nextSibling);
            lastTextNode.appendData(text.data);
            lastTextNode.parentNode.removeChild(text);
        }

        return {textNode: lastTextNode, offset: nodeOffset };
    }

    /**
     * Called after an operation is executed, this
     * function will check if the operation is an
     * 'edit', and in that case will update the
     * document's metadata, such as dc:creator,
     * meta:editing-cycles, and dc:creator.
     * @param {!Operation} op
     */
    function handleOperationExecuted(op) {
        var opspec = op.spec(),
            memberId = opspec.memberid,
            date = new Date(opspec.timestamp).toISOString(),
            odfContainer = odfCanvas.odfContainer(),
            /**@type{!{setProperties: !Object, removedProperties: ?Array.<!string>}}*/
            changedMetadata,
            fullName;

        // If the operation is an edit (that changes the
        // ODF that will be saved), then update metadata.
        if (op.isEdit) {
            fullName = self.getMember(memberId).getProperties().fullName;
            odfContainer.setMetadata({
                "dc:creator": fullName,
                "dc:date": date
            }, null);

            changedMetadata = {
                setProperties: {
                    "dc:creator": fullName,
                    "dc:date": date
                },
                removedProperties: []
            };

            // If no previous op was found in this session,
            // then increment meta:editing-cycles by 1.
            if (!lastEditingOp) {
                changedMetadata.setProperties["meta:editing-cycles"] = odfContainer.incrementEditingCycles();
                // Remove certain metadata fields that
                // should be updated as soon as edits happen,
                // but cannot be because we don't support those yet.
                if (!unsupportedMetadataRemoved) {
                    odfContainer.setMetadata(null, [
                        "meta:editing-duration",
                        "meta:document-statistic"
                    ]);
                }
            }

            lastEditingOp = op;
            self.emit(OdtDocument.signalMetadataUpdated, changedMetadata);
        }
    }

    /**
     * Upgrades literal whitespaces (' ') to <text:s> </text:s>,
     * when given a textNode containing the whitespace and an offset
     * indicating the location of the whitespace in it.
     * @param {!Text} textNode
     * @param {!number} offset
     * @return {!Element}
     */
    function upgradeWhitespaceToElement(textNode, offset) {
        runtime.assert(textNode.data[offset] === ' ', "upgradeWhitespaceToElement: textNode.data[offset] should be a literal space");

        var space = textNode.ownerDocument.createElementNS(Namespaces.textns, 'text:s'),
            container = textNode.parentNode,
            adjacentNode = textNode;

        space.appendChild(textNode.ownerDocument.createTextNode(' '));

        if (textNode.length === 1) {
            // The space is the only element in this node. Can simply replace it
            container.replaceChild(space, textNode);
        } else {
            textNode.deleteData(offset, 1);
            if (offset > 0) { // Don't create an empty text node if the offset is 0...
                if (offset < textNode.length) {
                    // Don't split if offset === textNode.length as this would add an empty text node after
                    textNode.splitText(offset);
                }
                adjacentNode = textNode.nextSibling;
            }
            container.insertBefore(space, adjacentNode);
        }
        return space;
    }

    /**
     * @param {!number} step
     * @return {undefined}
     */
    function upgradeWhitespacesAtPosition(step) {
        var positionIterator = getIteratorAtPosition(step),
            stepIterator = new StepIterator(filter, positionIterator),
            contentBounds,
            /**@type{?Node}*/
            container,
            offset,
            stepsToUpgrade = 2;

        // The step passed into this function is the point of change. Need to
        // upgrade whitespace to the left of the current step, and to the left of the next step
        runtime.assert(stepIterator.isStep(), "positionIterator is not at a step (requested step: " + step + ")");

        do {
            contentBounds = stepUtils.getContentBounds(stepIterator);
            if (contentBounds) {
                container = contentBounds.container;
                offset = contentBounds.startOffset;
                if (container.nodeType === Node.TEXT_NODE
                    && odfUtils.isSignificantWhitespace(/**@type{!Text}*/(container), offset)) {
                    container = upgradeWhitespaceToElement(/**@type{!Text}*/(container), offset);
                    // Reset the iterator position to the same step it was just on, which was just to
                    // the right of a space
                    stepIterator.setPosition(container, container.childNodes.length);
                    stepIterator.roundToPreviousStep();
                }
            }
            stepsToUpgrade -= 1;
        } while (stepsToUpgrade > 0 && stepIterator.nextStep());
    }

    /**
     * Upgrades any significant whitespace at the requested step, and one step right of the given
     * position to space elements.
     * @param {!number} step
     * @return {undefined}
     */
    this.upgradeWhitespacesAtPosition = upgradeWhitespacesAtPosition;

    /**
     * Returns the maximum available offset for the specified node.
     * @param {!Node} node
     * @return {!number}
     */
    function maxOffset(node) {
        return node.nodeType === Node.TEXT_NODE ? /**@type{!Text}*/(node).length : node.childNodes.length;
    }

    /**
     * Downgrades white space elements to normal spaces at the step iterators current step, and one step
     * to the right.
     *
     * @param {!StepIterator} stepIterator
     * @return {undefined}
     */
    function downgradeWhitespaces(stepIterator) {
        var contentBounds,
            /**@type{!Node}*/
            container,
            modifiedNodes = [],
            lastChild,
            stepsToUpgrade = 2;

        // The step passed into this function is the point of change. Need to
        // downgrade whitespace to the left of the current step, and to the left of the next step
        runtime.assert(stepIterator.isStep(), "positionIterator is not at a step");

        do {
            contentBounds = stepUtils.getContentBounds(stepIterator);
            if (contentBounds) {
                container = contentBounds.container;
                if (odfUtils.isDowngradableSpaceElement(container)) {
                    lastChild = /**@type{!Node}*/(container.lastChild);
                    while(container.firstChild) {
                        // Merge contained space text node up to replace container
                        modifiedNodes.push(container.firstChild);
                        container.parentNode.insertBefore(container.firstChild, container);
                    }
                    container.parentNode.removeChild(container);
                    // Reset the iterator position to the same step it was just on, which was just to
                    // the right of a space
                    stepIterator.setPosition(lastChild, maxOffset(lastChild));
                    stepIterator.roundToPreviousStep();
                }
            }
            stepsToUpgrade -= 1;
        } while (stepsToUpgrade > 0 && stepIterator.nextStep());

        modifiedNodes.forEach(domUtils.normalizeTextNodes);
    }
    this.downgradeWhitespaces = downgradeWhitespaces;

    /**
     * Downgrades white space elements to normal spaces at the specified step, and one step
     * to the right.
     *
     * @param {!number} step
     * @return {undefined}
     */
    this.downgradeWhitespacesAtPosition = function (step) {
        var positionIterator = getIteratorAtPosition(step),
            stepIterator = new StepIterator(filter, positionIterator);

        downgradeWhitespaces(stepIterator);
    };

    /**
     * This function will return the Text node as well as the offset in that text node
     * of the cursor.
     * @param {!number} position
     * @param {!string=} memberid
     * @return {?{textNode: !Text, offset: !number}}
     */
    this.getTextNodeAtStep = getTextNodeAtStep;

    /**
     * Returns the closest parent paragraph or root to the supplied container and offset
     * @param {!Node} container
     * @param {!number} offset
     * @param {!Node} root
     *
     * @return {!Node}
     */
    function paragraphOrRoot(container, offset, root) {
        var node = container.childNodes.item(offset) || container,
            paragraph = odfUtils.getParagraphElement(node);
        if (paragraph && domUtils.containsNode(root, paragraph)) {
            // Only return the paragraph if it is contained within the destination root
            return /**@type{!Node}*/(paragraph);
        }
        // Otherwise the step filter should be contained within the supplied root
        return root;
    }

    /**
     * Iterates through all cursors and checks if they are in
     * walkable positions; if not, move the cursor 1 filtered step backward
     * which guarantees walkable state for all cursors,
     * while keeping them inside the same root. An event will be raised for this cursor if it is moved
     */
    this.fixCursorPositions = function () {
        Object.keys(cursors).forEach(function (memberId) {
            var cursor = cursors[memberId],
                root = getRoot(cursor.getNode()),
                rootFilter = self.createRootFilter(root),
                subTree,
                startPoint,
                endPoint,
                selectedRange,
                cursorMoved = false;

            selectedRange = cursor.getSelectedRange();
            subTree = paragraphOrRoot(/**@type{!Node}*/(selectedRange.startContainer), selectedRange.startOffset, root);
            startPoint = createStepIterator(/**@type{!Node}*/(selectedRange.startContainer), selectedRange.startOffset,
                [filter, rootFilter], subTree);

            if (!selectedRange.collapsed) {
                subTree = paragraphOrRoot(/**@type{!Node}*/(selectedRange.endContainer), selectedRange.endOffset, root);
                endPoint = createStepIterator(/**@type{!Node}*/(selectedRange.endContainer), selectedRange.endOffset,
                    [filter, rootFilter], subTree);
            } else {
                endPoint = startPoint;
            }

            if (!startPoint.isStep() || !endPoint.isStep()) {
                cursorMoved = true;
                runtime.assert(startPoint.roundToClosestStep(), "No walkable step found for cursor owned by " + memberId);
                selectedRange.setStart(startPoint.container(), startPoint.offset());
                runtime.assert(endPoint.roundToClosestStep(), "No walkable step found for cursor owned by " + memberId);
                selectedRange.setEnd(endPoint.container(), endPoint.offset());
            } else if (startPoint.container() === endPoint.container() && startPoint.offset() === endPoint.offset()) {
                // The range *should* be collapsed
                if (!selectedRange.collapsed || cursor.getAnchorNode() !== cursor.getNode()) {
                    // It might not be collapsed if there are other unwalkable nodes (e.g., cursors)
                    // between the cursor and anchor nodes. In this case, force the cursor to collapse
                    cursorMoved = true;
                    selectedRange.setStart(startPoint.container(), startPoint.offset());
                    selectedRange.collapse(true);
                }
            }

            if (cursorMoved) {
                cursor.setSelectedRange(selectedRange, cursor.hasForwardSelection());
                self.emit(OpsDocument.signalCursorMoved, cursor);
            }
        });
    };

    /**
     * This function returns the position in ODF world of the cursor of the member.
     * @param {!string} memberid
     * @return {!number}
     */
    this.getCursorPosition = function (memberid) {
        var cursor = cursors[memberid];
        return cursor ? stepsTranslator.convertDomPointToSteps(cursor.getNode(), 0) : 0;
    };

    /**
     * This function returns the position and selection length in ODF world of
     * the cursor of the member.
     * position is always the number of steps from root node to the anchor node
     * length is the number of steps from anchor node to focus node
     * !IMPORTANT! length is a vector, and may be negative if the cursor selection
     * is reversed (i.e., user clicked and dragged the cursor backwards)
     * @param {!string} memberid
     * @return {{position: !number, length: !number}}
     */
    this.getCursorSelection = function (memberid) {
        var cursor = cursors[memberid],
            focusPosition = 0,
            anchorPosition = 0;
        if (cursor) {
            focusPosition = stepsTranslator.convertDomPointToSteps(cursor.getNode(), 0);
            anchorPosition = stepsTranslator.convertDomPointToSteps(cursor.getAnchorNode(), 0);
        }
        return {
            position: anchorPosition,
            length: focusPosition - anchorPosition
        };
    };
    /**
     * @return {!PositionFilter}
     */
    this.getPositionFilter = function () {
        return filter;
    };

    /**
     * @return {!OdfCanvas}
     */
    this.getOdfCanvas = function () {
        return odfCanvas;
    };

    /**
     * @return {!Canvas}
     */
    this.getCanvas = function () {
        return odfCanvas;
    };

    /**
     * @return {!Element}
     */
    this.getRootNode = getRootNode;

    /**
     * @param {!Member} member
     * @return {undefined}
     */
    this.addMember = function (member) {
        runtime.assert(members[member.getMemberId()] === undefined, "This member already exists");
        members[member.getMemberId()] = member;
    };

    /**
     * @param {!string} memberId
     * @return {?Member}
     */
    this.getMember = function (memberId) {
        return members.hasOwnProperty(memberId) ? members[memberId] : null;
    };

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    this.removeMember = function (memberId) {
        delete members[memberId];
    };

    /**
     * @param {!string} memberid
     * @return {OdtCursor}
     */
    this.getCursor = function (memberid) {
        return cursors[memberid];
    };

    /**
     * @param {!string} memberid
     * @return {!boolean}
     */
    this.hasCursor = function (memberid) {
        return cursors.hasOwnProperty(memberid);
    };
    /**
     * @return {!Array.<string>}
     */
    this.getMemberIds = function () {
        return Object.keys(members);
    };

    /**
     * Adds the specified cursor to the ODT document. The cursor will be collapsed
     * to the first available cursor position in the document.
     * @param {!OdtCursor} cursor
     * @return {undefined}
     */
    this.addCursor = function (cursor) {
        runtime.assert(Boolean(cursor), "OdtDocument::addCursor without cursor");
        var memberid = cursor.getMemberId(),
            initialSelection = self.convertCursorToDomRange(0, 0);

        runtime.assert(typeof memberid === "string", "OdtDocument::addCursor has cursor without memberid");
        runtime.assert(!cursors[memberid], "OdtDocument::addCursor is adding a duplicate cursor with memberid " + memberid);
        cursor.setSelectedRange(initialSelection, true);

        cursors[memberid] = cursor;
    };

    /**
     * @param {!string} memberid
     * @return {!boolean}
     */
    this.removeCursor = function (memberid) {
        var cursor = cursors[memberid];
        if (cursor) {
            cursor.removeFromDocument();
            delete cursors[memberid];
            self.emit(OpsDocument.signalCursorRemoved, memberid);
            return true;
        }
        return false;
    };

    /**
     * Moves the cursor/selection of a given memberid to the
     * given position+length combination and adopts the given
     * selectionType.
     * It is the caller's responsibility to decide if and when
     * to subsequently fire signalCursorMoved.
     * @param {!string} memberid
     * @param {!number} position
     * @param {!number} length
     * @param {!string=} selectionType
     * @return {undefined}
     */
    this.moveCursor = function (memberid, position, length, selectionType) {
        var cursor = cursors[memberid],
            selectionRange = self.convertCursorToDomRange(position, length);
        if (cursor) {
            cursor.setSelectedRange(selectionRange, length >= 0);
            cursor.setSelectionType(selectionType || OdtCursor.RangeSelection);
        }
    };

    /**
     * @return {!Formatting}
     */
    this.getFormatting = function () {
        return odfCanvas.getFormatting();
    };

    /**
     * @param {!string} eventid
     * @param {*} args
     * @return {undefined}
     */
    this.emit = function (eventid, args) {
        eventNotifier.emit(eventid, args);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * @param {string|!Node} inputMemberId
     * @return {!RootFilter}
     */
    this.createRootFilter = function (inputMemberId) {
        return new RootFilter(inputMemberId, cursors, getRoot);
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.close = function (callback) {
        // TODO: check if anything needs to be cleaned up
        callback();
    };

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        callback();
    };

    /**
     * @return {undefined}
     */
    function init() {
        var rootNode = getRootNode();

        filter = new TextPositionFilter();
        stepsTranslator = new OdtStepsTranslator(rootNode, createPositionIterator(rootNode), filter, 500);
        eventNotifier.subscribe(OdtDocument.signalStepsInserted, stepsTranslator.handleStepsInserted);
        eventNotifier.subscribe(OdtDocument.signalStepsRemoved, stepsTranslator.handleStepsRemoved);
        eventNotifier.subscribe(OdtDocument.signalOperationEnd, handleOperationExecuted);
        eventNotifier.subscribe(OdtDocument.signalProcessingBatchEnd, task.processTasks);
    }
    init();
}

/**@const*/OdtDocument.signalParagraphChanged = "paragraph/changed";
/**@const*/OdtDocument.signalTableAdded = "table/added";
/**@const*/OdtDocument.signalCommonStyleCreated = "style/created";
/**@const*/OdtDocument.signalCommonStyleDeleted = "style/deleted";
/**@const*/OdtDocument.signalParagraphStyleModified = "paragraphstyle/modified";
/**@const*/OdtDocument.signalOperationStart = "operation/start";
/**@const*/OdtDocument.signalOperationEnd = "operation/end";
/**@const*/OdtDocument.signalProcessingBatchStart = "router/batchstart";
/**@const*/OdtDocument.signalProcessingBatchEnd = "router/batchend";
/**@const*/OdtDocument.signalUndoStackChanged = "undo/changed";
/**@const*/OdtDocument.signalStepsInserted = "steps/inserted";
/**@const*/OdtDocument.signalStepsRemoved = "steps/removed";
/**@const*/OdtDocument.signalMetadataUpdated = "metadata/updated";
/**@const*/OdtDocument.signalAnnotationAdded = "annotation/added";

/**@const*/
exports.OdtDocument = OdtDocument;
