/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

var runtime = require("../runtime").runtime;
var Namespaces = require("../odf/Namespaces").Namespaces;
var LazyProperty = require("../core/LazyProperty").LazyProperty;
var Destroyable = require("../core/Destroyable").Destroyable;
var Session = require("../ops/Session").Session;
var SessionConstraints = require("./SessionConstraints").SessionConstraints;
var SessionContext = require("./SessionContext").SessionContext;
var ObjectNameGenerator = require("../odf/ObjectNameGenerator").ObjectNameGenerator;
var EventNotifier = require("../core/EventNotifier").EventNotifier;
var OpAddStyle = require("../ops/OpAddStyle").OpAddStyle;
var OpSetParagraphStyle = require("../ops/OpSetParagraphStyle").OpSetParagraphStyle;
var OpApplyDirectStyling = require("../ops/OpApplyDirectStyling").OpApplyDirectStyling;
var StyleSummary = require("./StyleSummary").StyleSummary;
var OdtDocument = require("../ops/OdtDocument").OdtDocument;
var OpsDocument = require("../ops/Document").Document;
var OdtCursor = require("../ops/OdtCursor").OdtCursor;
var CommonConstraints = require("./CommonConstraints").CommonConstraints;
var odfUtils = require("../odf/OdfUtils");
var StepDirection = require("../core/enums").StepDirection;
var utils = require("../core/Utils");
var Operation = require("../ops/Operation").Operation;
var Formatting = require("../odf/Formatting").Formatting;

/**@typedef{!Object.<!string,(!string|!Object.<!string,!string>)>}*/
Formatting.StyleData;

/**
 * @constructor
 * @implements {Destroyable}
 * @param {!Session} session
 * @param {!SessionConstraints} sessionConstraints
 * @param {!SessionContext} sessionContext
 * @param {!string} inputMemberId
 * @param {!ObjectNameGenerator} objectNameGenerator
 * @param {!boolean} directTextStylingEnabled
 * @param {!boolean} directParagraphStylingEnabled
 */
function DirectFormattingController(
    session,
    sessionConstraints,
    sessionContext,
    inputMemberId,
    objectNameGenerator,
    directTextStylingEnabled,
    directParagraphStylingEnabled
    ) {
    "use strict";

    var self = this,
        odtDocument = session.getOdtDocument(),
        eventNotifier = new EventNotifier([
            DirectFormattingController.enabledChanged,
            DirectFormattingController.textStylingChanged,
            DirectFormattingController.paragraphStylingChanged
        ]),
        /**@const*/
        textns = Namespaces.textns,
        /**@const*/
        NEXT = StepDirection.NEXT,
        /**@type{?Formatting.StyleData}*/
        directCursorStyleProperties = null,
        // cached text settings
        /**@type{!DirectFormattingController.SelectionInfo}*/
        lastSignalledSelectionInfo,
        /**@type {!LazyProperty.<!DirectFormattingController.SelectionInfo>} */
        selectionInfoCache;

    /**
     * Gets the current selection information style summary
     * @return {!StyleSummary}
     */
    function getCachedStyleSummary() {
        return selectionInfoCache.value().styleSummary;
    }

    /**
     * @return {!{directTextStyling: !boolean, directParagraphStyling: !boolean}}
     */
    function getCachedEnabledFeatures() {
        return selectionInfoCache.value().enabledFeatures;
    }
    this.enabledFeatures = getCachedEnabledFeatures;
    
    /**
     * Fetch all the character elements and text nodes in the specified range, or if the range is collapsed, the node just to
     * the left of the cursor.
     * @param {!Range} range
     * @return {!Array.<!Node>}
     */
    function getNodes(range) {
        var container, nodes;

        if (range.collapsed) {
            container = range.startContainer;
            // Attempt to find the node at the specified startOffset within the startContainer.
            // In the case where a range starts at (parent, 1), this will mean the
            // style information is retrieved for the child node at index 1.

            // Also, need to check the length is less than the number of child nodes, as a range is
            // legally able to start at (parent, parent.childNodes.length).
            if (container.hasChildNodes() && range.startOffset < container.childNodes.length) {
                container = container.childNodes.item(range.startOffset);
            }
            nodes = [container];
        } else {
            nodes = odfUtils.getTextElements(range, true, false);
        }

        return nodes;
    }

    /**
     * Get all styles currently applied to the selected range. If the range is collapsed,
     * this will return the style the next inserted character will have
     * @return {!DirectFormattingController.SelectionInfo}
     */
    function getSelectionInfo() {
        var cursor = odtDocument.getCursor(inputMemberId),
            range = cursor && cursor.getSelectedRange(),
            nodes = [],
            /**@type{!Array.<!Formatting.AppliedStyle>}*/
            selectionStyles = [],
            selectionContainsText = true,
            enabledFeatures = {
                directTextStyling: true,
                directParagraphStyling: true
            };

        if (range) {
            nodes = getNodes(range);
            if (nodes.length === 0) {
                nodes = [range.startContainer, range.endContainer];
                selectionContainsText = false;
            }
            selectionStyles = odtDocument.getFormatting().getAppliedStyles(nodes);
        }

        if (selectionStyles[0] !== undefined && directCursorStyleProperties) {
            // direct cursor styles add to the style of the existing range, overriding where defined
            selectionStyles[0].styleProperties = utils.mergeObjects(selectionStyles[0].styleProperties,
                                                                    directCursorStyleProperties);
        }

        if (sessionConstraints.getState(CommonConstraints.EDIT.REVIEW_MODE) === true) {
            enabledFeatures.directTextStyling = enabledFeatures.directParagraphStyling = /**@type{!boolean}*/(sessionContext.isLocalCursorWithinOwnAnnotation());
        }

        if (enabledFeatures.directTextStyling) {
            enabledFeatures.directTextStyling = selectionContainsText
                                                && cursor !== undefined // cursor might not be registered
                                                && cursor.getSelectionType() === OdtCursor.RangeSelection;
        }

        return /**@type{!DirectFormattingController.SelectionInfo}*/({
            enabledFeatures: enabledFeatures,
            appliedStyles: selectionStyles,
            styleSummary: new StyleSummary(selectionStyles)
        });
    }

    /**
     * Create a map containing all the keys that have a different value
     * in the new summary object.
     * @param {!Object.<string,function():*>} oldSummary
     * @param {!Object.<string,function():*>} newSummary
     * @return {!Object.<!string, *>}
     */
    function createDiff(oldSummary, newSummary) {
        var diffMap = {};
        Object.keys(oldSummary).forEach(function (funcName) {
            var oldValue = oldSummary[funcName](),
                newValue = newSummary[funcName]();

            if (oldValue !== newValue) {
                diffMap[funcName] = newValue;
            }
        });
        return diffMap;
    }

    /**
     * @return {undefined}
     */
    function emitSelectionChanges() {
        var textStyleDiff,
            paragraphStyleDiff,
            lastStyleSummary = lastSignalledSelectionInfo.styleSummary,
            newSelectionInfo = selectionInfoCache.value(),
            newSelectionStylesSummary = newSelectionInfo.styleSummary,
            lastEnabledFeatures = lastSignalledSelectionInfo.enabledFeatures,
            newEnabledFeatures = newSelectionInfo.enabledFeatures,
            enabledFeaturesChanged;

        textStyleDiff = createDiff(lastStyleSummary.text, newSelectionStylesSummary.text);
        paragraphStyleDiff = createDiff(lastStyleSummary.paragraph, newSelectionStylesSummary.paragraph);

        enabledFeaturesChanged = !(newEnabledFeatures.directTextStyling === lastEnabledFeatures.directTextStyling
            && newEnabledFeatures.directParagraphStyling === lastEnabledFeatures.directParagraphStyling);

        lastSignalledSelectionInfo = newSelectionInfo;

        if (enabledFeaturesChanged) {
            eventNotifier.emit(DirectFormattingController.enabledChanged, newEnabledFeatures);
        }

        if (Object.keys(textStyleDiff).length > 0) {
            eventNotifier.emit(DirectFormattingController.textStylingChanged, textStyleDiff);
        }

        if (Object.keys(paragraphStyleDiff).length > 0) {
            eventNotifier.emit(DirectFormattingController.paragraphStylingChanged, paragraphStyleDiff);
        }
    }

    /**
     * Resets and immediately updates the current selection info. VERY SLOW... please use sparingly.
     * @return {undefined}
     */
    function forceSelectionInfoRefresh() {
        selectionInfoCache.reset();
        emitSelectionChanges();
    }

    /**
     * @param {!OdtCursor|!string} cursorOrId
     * @return {undefined}
     */
    function onCursorEvent(cursorOrId) {
        var cursorMemberId = (typeof cursorOrId === "string")
                                ? cursorOrId : cursorOrId.getMemberId();
        if (cursorMemberId === inputMemberId) {
            selectionInfoCache.reset();
        }
    }

    /**
     * @return {undefined}
     */
    function onParagraphStyleModified() {
        // TODO: check if the cursor (selection) is actually affected
        selectionInfoCache.reset();
    }

    /**
     * @param {!{paragraphElement:Element}} args
     * @return {undefined}
     */
    function onParagraphChanged(args) {
        var cursor = odtDocument.getCursor(inputMemberId),
            p = args.paragraphElement;

        if (cursor && odfUtils.getParagraphElement(cursor.getNode()) === p) {
            selectionInfoCache.reset();
        }
    }

    /**
     * @param {!function():boolean} predicate
     * @param {!function(!boolean):undefined} toggleMethod
     * @return {!boolean}
     */
    function toggle(predicate, toggleMethod) {
        toggleMethod(!predicate());
        return true;
    }

    /**
     * Apply the supplied text properties to the current range. If no range is selected,
     * this styling will be applied to the next character entered.
     * @param {!Formatting.StyleData} textProperties
     * @return {undefined}
     */
    function formatTextSelection(textProperties) {
        if (!getCachedEnabledFeatures().directTextStyling) {
            return;
        }

        var selection = odtDocument.getCursorSelection(inputMemberId),
            op,
            properties = {'style:text-properties' : textProperties};

        if (selection.length !== 0) {
            op = new OpApplyDirectStyling();
            op.init({
                memberid: inputMemberId,
                position: selection.position,
                length: selection.length,
                setProperties: properties
            });
            session.enqueue([op]);
        } else {
            // Direct styling is additive. E.g., if the user selects bold and then italic, the intent is to produce
            // bold & italic text
            directCursorStyleProperties = utils.mergeObjects(directCursorStyleProperties || {}, properties);
            selectionInfoCache.reset();
        }
    }
    this.formatTextSelection = formatTextSelection;

    /**
     * @param {!string} propertyName
     * @param {!string} propertyValue
     * @return {undefined}
     */
    function applyTextPropertyToSelection(propertyName, propertyValue) {
        var textProperties = {};
        textProperties[propertyName] = propertyValue;
        formatTextSelection(textProperties);
    }

    /**
     * Generate an operation that would apply the current direct cursor styling to the specified
     * position and length
     * @param {!number} position
     * @param {!number} length
     * @param {!boolean} useCachedStyle
     * @return {Operation}
     */
    this.createCursorStyleOp = function (position, length, useCachedStyle) {
        var styleOp = null,
            /**@type{!Formatting.AppliedStyle|undefined}*/
            appliedStyles,
            /**@type{?Formatting.StyleData|undefined}*/
            properties = directCursorStyleProperties;

        if (useCachedStyle) {
            appliedStyles = selectionInfoCache.value().appliedStyles[0];
            properties = appliedStyles && appliedStyles.styleProperties;
        }

        if (properties && properties['style:text-properties']) {
            styleOp = new OpApplyDirectStyling();
            styleOp.init({
                memberid: inputMemberId,
                position: position,
                length: length,
                setProperties: {'style:text-properties': properties['style:text-properties']}
            });
            directCursorStyleProperties = null;
            selectionInfoCache.reset();
        }
        return styleOp;
    };

    /**
     * Listen for local operations and clear the local cursor styling if necessary
     * @param {!Operation} op
     */
    function clearCursorStyle(op) {
        var spec = op.spec();
        if (directCursorStyleProperties && spec.memberid === inputMemberId) {
            if (spec.optype !== "SplitParagraph") {
                // Most operations by the local user should clear the current cursor style
                // SplitParagraph is an exception because at the time the split occurs, there has been no element
                // added to apply the style to. Even after a split, the cursor should still style the next inserted
                // character
                directCursorStyleProperties = null;
                selectionInfoCache.reset();
            }
        }
    }

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setBold(checked) {
        var value = checked ? 'bold' : 'normal';
        applyTextPropertyToSelection('fo:font-weight', value);
    }
    this.setBold = setBold;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setItalic(checked) {
        var value = checked ? 'italic' : 'normal';
        applyTextPropertyToSelection('fo:font-style', value);
    }
    this.setItalic = setItalic;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setHasUnderline(checked) {
        var value = checked ? 'solid' : 'none';
        applyTextPropertyToSelection('style:text-underline-style', value);
    }
    this.setHasUnderline = setHasUnderline;

    /**
     * @param {!boolean} checked
     * @return {undefined}
     */
    function setHasStrikethrough(checked) {
        var value = checked ? 'solid' : 'none';
        applyTextPropertyToSelection('style:text-line-through-style', value);
    }
    this.setHasStrikethrough = setHasStrikethrough;

    /**
     * @param {!number} value
     * @return {undefined}
     */
    function setFontSize(value) {
        applyTextPropertyToSelection('fo:font-size', value + "pt");
    }
    this.setFontSize = setFontSize;

    /**
     * @param {!string} value
     * @return {undefined}
     */
    function setFontName(value) {
        applyTextPropertyToSelection('style:font-name', value);
    }
    this.setFontName = setFontName;

    /**
     * Get all styles currently applied to the selected range. If the range is collapsed,
     * this will return the style the next inserted character will have.
     * (Note, this is not used internally by WebODF, but is provided as a convenience method
     * for external consumers)
     * @return {!Array.<!Formatting.AppliedStyle>}
     */
    this.getAppliedStyles = function () {
        return selectionInfoCache.value().appliedStyles;
    };

    /**
     * @return {!boolean}
     */
    this.toggleBold = toggle.bind(self, function () { return getCachedStyleSummary().isBold(); }, setBold);

    /**
     * @return {!boolean}
     */
    this.toggleItalic = toggle.bind(self, function () { return getCachedStyleSummary().isItalic(); }, setItalic);

    /**
     * @return {!boolean}
     */
    this.toggleUnderline = toggle.bind(self, function () { return getCachedStyleSummary().hasUnderline(); }, setHasUnderline);

    /**
     * @return {!boolean}
     */
    this.toggleStrikethrough = toggle.bind(self, function () { return getCachedStyleSummary().hasStrikeThrough(); }, setHasStrikethrough);

    /**
     * @return {!boolean}
     */
    this.isBold = function () {
        return getCachedStyleSummary().isBold();
    };

    /**
     * @return {!boolean}
     */
    this.isItalic = function () {
        return getCachedStyleSummary().isItalic();
    };

    /**
     * @return {!boolean}
     */
    this.hasUnderline = function () {
        return getCachedStyleSummary().hasUnderline();
    };

    /**
     * @return {!boolean}
     */
    this.hasStrikeThrough = function () {
        return getCachedStyleSummary().hasStrikeThrough();
    };

    /**
     * @return {number|undefined}
     */
    this.fontSize = function () {
        return getCachedStyleSummary().fontSize();
    };

    /**
     * @return {string|undefined}
     */
    this.fontName = function () {
        return getCachedStyleSummary().fontName();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedLeft = function () {
        return getCachedStyleSummary().isAlignedLeft();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedCenter = function () {
        return getCachedStyleSummary().isAlignedCenter();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedRight = function () {
        return getCachedStyleSummary().isAlignedRight();
    };

    /**
     * @return {!boolean}
     */
    this.isAlignedJustified = function () {
        return getCachedStyleSummary().isAlignedJustified();
    };

    /**
     * @param {!Object.<string,string>} obj
     * @param {string} key
     * @return {string|undefined}
     */
    function getOwnProperty(obj, key) {
        return obj.hasOwnProperty(key) ? obj[key] : undefined;
    }

    /**
     * @param {!function(!Formatting.StyleData) : !Formatting.StyleData} applyDirectStyling
     * @return {undefined}
     */
    function applyParagraphDirectStyling(applyDirectStyling) {
        if (!getCachedEnabledFeatures().directParagraphStyling) {
            return;
        }

        var range = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            paragraphs = odfUtils.getParagraphElements(range),
            formatting = odtDocument.getFormatting(),
            operations = [],
            derivedStyleNames = {},
            /**@type{string|undefined}*/
            defaultStyleName;

        paragraphs.forEach(function (paragraph) {
            var paragraphStartPoint = odtDocument.convertDomPointToCursorStep(paragraph, 0, NEXT),
                paragraphStyleName = paragraph.getAttributeNS(Namespaces.textns, "style-name"),
                /**@type{string|undefined}*/
                newParagraphStyleName,
                opAddStyle,
                opSetParagraphStyle,
                paragraphProperties;

            // Try and reuse an existing paragraph style if possible
            if (paragraphStyleName) {
                newParagraphStyleName = getOwnProperty(derivedStyleNames, paragraphStyleName);
            } else {
                newParagraphStyleName = defaultStyleName;
            }

            if (!newParagraphStyleName) {
                newParagraphStyleName = objectNameGenerator.generateStyleName();
                if (paragraphStyleName) {
                    derivedStyleNames[paragraphStyleName] = newParagraphStyleName;
                    paragraphProperties = formatting.createDerivedStyleObject(paragraphStyleName, "paragraph", {});
                } else {
                    defaultStyleName = newParagraphStyleName;
                    paragraphProperties = {};
                }

                // The assumption is that applyDirectStyling will return the same transform given the same
                // paragraph properties (e.g., there is nothing dependent on whether this is the 10th paragraph)
                paragraphProperties = applyDirectStyling(paragraphProperties);
                opAddStyle = new OpAddStyle();
                opAddStyle.init({
                    memberid: inputMemberId,
                    styleName: newParagraphStyleName.toString(),
                    styleFamily: 'paragraph',
                    isAutomaticStyle: true,
                    setProperties: paragraphProperties
                });
                operations.push(opAddStyle);
            }


            opSetParagraphStyle = new OpSetParagraphStyle();
            opSetParagraphStyle.init({
                memberid: inputMemberId,
                styleName: newParagraphStyleName.toString(),
                position: paragraphStartPoint
            });

            operations.push(opSetParagraphStyle);
        });
        session.enqueue(operations);
    }

    /**
     * @param {!Formatting.StyleData} styleOverrides
     * @return {undefined}
     */
    function applySimpleParagraphDirectStyling(styleOverrides) {
        applyParagraphDirectStyling(function (paragraphStyle) {
            return /**@type {!Formatting.StyleData}*/(utils.mergeObjects(paragraphStyle, styleOverrides));
        });
    }

    /**
     * @param {!string} alignment
     * @return {undefined}
     */
    function alignParagraph(alignment) {
        applySimpleParagraphDirectStyling({"style:paragraph-properties" : {"fo:text-align" : alignment}});
    }

    /**
     * @return {!boolean}
     */
    this.alignParagraphLeft = function () {
        alignParagraph('left');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphCenter = function () {
        alignParagraph('center');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphRight = function () {
        alignParagraph('right');
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.alignParagraphJustified = function () {
        alignParagraph('justify');
        return true;
    };

    /**
     * @param {!number} direction
     * @param {!Formatting.StyleData} paragraphStyle
     * @return {!Formatting.StyleData}
     */
    function modifyParagraphIndent(direction, paragraphStyle) {
        var tabStopDistance = odtDocument.getFormatting().getDefaultTabStopDistance(),
            paragraphProperties = paragraphStyle["style:paragraph-properties"],
            indentValue,
            indent,
            newIndent;
        if (paragraphProperties) {
            indentValue = /**@type {!string}*/(paragraphProperties["fo:margin-left"]);
            indent = odfUtils.parseLength(indentValue);
        }

        if (indent && indent.unit === tabStopDistance.unit) {
            newIndent = (indent.value + (direction * tabStopDistance.value)) + indent.unit;
        } else {
            // TODO unit-conversion would allow indent to work irrespective of the paragraph's indent type
            newIndent = (direction * tabStopDistance.value) + tabStopDistance.unit;
        }

        return /**@type {!Formatting.StyleData}*/(utils.mergeObjects(paragraphStyle, {"style:paragraph-properties" : {"fo:margin-left" : newIndent}}));
    }

    /**
     * @return {!boolean}
     */
    this.indent = function () {
        applyParagraphDirectStyling(modifyParagraphIndent.bind(null, 1));
        return true;
    };

    /**
     * @return {!boolean}
     */
    this.outdent = function () {
        applyParagraphDirectStyling(modifyParagraphIndent.bind(null, -1));
        return true;
    };

    /**
     * Check if the selection ends at the last step of a paragraph.
     * @param {!Range} range
     * @param {!Node} paragraphNode
     * @return {boolean}
     */
    function isSelectionAtTheEndOfLastParagraph(range, paragraphNode) {
        var stepIterator,
            filters = [odtDocument.getPositionFilter(), odtDocument.createRootFilter(inputMemberId)];

        stepIterator = odtDocument.createStepIterator(/**@type{!Node}*/(range.endContainer), range.endOffset,
                                                        filters, paragraphNode);
        return stepIterator.nextStep() === false;
    }

    /**
     * Returns true if the first text node in the selection has different text style from the first paragraph; otherwise false.
     * @param {!Range} range
     * @param {!Node} paragraphNode
     * @return {!boolean}
     */
    function isTextStyleDifferentFromFirstParagraph(range, paragraphNode) {
        var textNodes = getNodes(range),
            // If the selection has no text nodes, fetch the text style at the start of the range instead
            selectedNodes = textNodes.length === 0 ? [range.startContainer] : textNodes,
            appliedTextStyles = odtDocument.getFormatting().getAppliedStyles(selectedNodes),
            textStyle = appliedTextStyles.length > 0 ? appliedTextStyles[0].styleProperties : undefined,
            paragraphStyle = odtDocument.getFormatting().getAppliedStylesForElement(paragraphNode).styleProperties;
        if (!textStyle || textStyle['style:family'] !== 'text' || !textStyle['style:text-properties']) {
            return false;
        }
        if (!paragraphStyle || !paragraphStyle['style:text-properties']) {
            return true;
        }

        textStyle = /**@type {!Formatting.StyleData}*/(textStyle['style:text-properties']);
        paragraphStyle = /**@type {!Formatting.StyleData}*/(paragraphStyle['style:text-properties']);
        // <style:text-properties> only has attributes, so no need to look for child elements (as in: objects)
        return !Object.keys(textStyle).every(function (key) {
            return textStyle[key] === paragraphStyle[key];
        });
    }

    /**
     * TODO: HACK, REMOVE
     * Generates operations that would create and apply the current direct cursor
     * styling to the paragraph at given position.
     * @param {number} position
     * @return {!Array.<!Operation>}
     */
    this.createParagraphStyleOps = function (position) {
        if (!getCachedEnabledFeatures().directParagraphStyling) {
            return [];
        }

        var cursor = odtDocument.getCursor(inputMemberId),
            range = cursor.getSelectedRange(),
            operations = [], op,
            startNode, endNode, paragraphNode,
            appliedStyles,
            properties, parentStyleName, styleName;

        if (cursor.hasForwardSelection()) {
            startNode = cursor.getAnchorNode();
            endNode = cursor.getNode();
        } else {
            startNode = cursor.getNode();
            endNode = cursor.getAnchorNode();
        }

        paragraphNode = /**@type{!Element}*/(odfUtils.getParagraphElement(endNode));
        runtime.assert(Boolean(paragraphNode), "DirectFormattingController: Cursor outside paragraph");
        if (!isSelectionAtTheEndOfLastParagraph(range, paragraphNode)) {
            return operations;
        }

        if (endNode !== startNode) {
            paragraphNode = /**@type{!Element}*/(odfUtils.getParagraphElement(startNode));
        }

        if (!directCursorStyleProperties && !isTextStyleDifferentFromFirstParagraph(range, paragraphNode)) {
            return operations;
        }

        appliedStyles = selectionInfoCache.value().appliedStyles[0];
        properties = appliedStyles && appliedStyles.styleProperties;
        if (!properties) {
            return operations;
        }

        parentStyleName = paragraphNode.getAttributeNS(textns, 'style-name');
        if (parentStyleName) {
            properties = {
                'style:text-properties': properties['style:text-properties']
            };
            properties = odtDocument.getFormatting().createDerivedStyleObject(parentStyleName, 'paragraph', properties);
        }

        styleName = objectNameGenerator.generateStyleName();
        op = new OpAddStyle();
        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            styleFamily: 'paragraph',
            isAutomaticStyle: true,
            setProperties: properties
        });
        operations.push(op);

        op = new OpSetParagraphStyle();
        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            position: position
        });
        operations.push(op);

        return operations;
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
     * @param {!function(!Error=)} callback passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(OpsDocument.signalCursorAdded, onCursorEvent);
        odtDocument.unsubscribe(OpsDocument.signalCursorRemoved, onCursorEvent);
        odtDocument.unsubscribe(OpsDocument.signalCursorMoved, onCursorEvent);
        odtDocument.unsubscribe(OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.unsubscribe(OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.unsubscribe(OdtDocument.signalOperationEnd, clearCursorStyle);
        odtDocument.unsubscribe(OdtDocument.signalProcessingBatchEnd, emitSelectionChanges);
        sessionConstraints.unsubscribe(CommonConstraints.EDIT.REVIEW_MODE, forceSelectionInfoRefresh);
        callback();
    };

    /**
     * @return {undefined}
     */
    /*jslint emptyblock: true*/
    function emptyFunction() {
    }
    /*jslint emptyblock: false*/

    /**
     * @return {!boolean}
     */
    function emptyBoolFunction () {
        return false;
    }

    /**
     * @return {!boolean}
     */
    function emptyFalseReturningFunction() {
        return false;
    }

    /**
     * @return {!DirectFormattingController.SelectionInfo}
     */
    function getCachedSelectionInfo() {
        return selectionInfoCache.value();
    }

    function init() {
        odtDocument.subscribe(OpsDocument.signalCursorAdded, onCursorEvent);
        odtDocument.subscribe(OpsDocument.signalCursorRemoved, onCursorEvent);
        odtDocument.subscribe(OpsDocument.signalCursorMoved, onCursorEvent);
        odtDocument.subscribe(OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.subscribe(OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.subscribe(OdtDocument.signalOperationEnd, clearCursorStyle);
        odtDocument.subscribe(OdtDocument.signalProcessingBatchEnd, emitSelectionChanges);
        sessionConstraints.subscribe(CommonConstraints.EDIT.REVIEW_MODE, forceSelectionInfoRefresh);
        selectionInfoCache = new LazyProperty(getSelectionInfo);
        // Using a function rather than calling selectionInfoCache.value() directly because Closure Compiler's generics
        // inference is quite limited and does not seem to recognise the LazyProperty type interface correctly
        // within the function that creates the instance. Everywhere else in this file has no issues with it though...
        lastSignalledSelectionInfo = getCachedSelectionInfo();

        if (!directTextStylingEnabled) {
            self.formatTextSelection = emptyFunction;
            self.setBold = emptyFunction;
            self.setItalic = emptyFunction;
            self.setHasUnderline = emptyFunction;
            self.setHasStrikethrough = emptyFunction;
            self.setFontSize = emptyFunction;
            self.setFontName = emptyFunction;
            self.toggleBold = emptyFalseReturningFunction;
            self.toggleItalic = emptyFalseReturningFunction;
            self.toggleUnderline = emptyFalseReturningFunction;
            self.toggleStrikethrough = emptyFalseReturningFunction;
        }

        if (!directParagraphStylingEnabled) {
            self.alignParagraphCenter = emptyBoolFunction;
            self.alignParagraphJustified = emptyBoolFunction;
            self.alignParagraphLeft = emptyBoolFunction;
            self.alignParagraphRight = emptyBoolFunction;
            self.createParagraphStyleOps = function () { return []; };
            self.indent = emptyBoolFunction;
            self.outdent = emptyBoolFunction;
        }
    }

    init();
};

/**@const*/DirectFormattingController.enabledChanged = "enabled/changed";
/**@const*/DirectFormattingController.textStylingChanged = "textStyling/changed";
/**@const*/DirectFormattingController.paragraphStylingChanged = "paragraphStyling/changed";

/**
 * @constructor
 * @struct
 */
DirectFormattingController.SelectionInfo = function() {
    "use strict";

    /**
     * Specifies which forms of styling options are enabled for the current selection.
     * @type {!{directTextStyling: !boolean, directParagraphStyling: !boolean}}
     */
    this.enabledFeatures;

    /**
     * Applied styles in the selection
     * @type {!Array.<!Formatting.AppliedStyle>}
     */
    this.appliedStyles;

    /**
     * Style summary for the selection
     * @type {!StyleSummary}
     */
    this.styleSummary;
}
/**@const*/
exports.DirectFormattingController = DirectFormattingController;
