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

/*global Node*/

var Destroyable = require("../core/Destroyable").Destroyable;
var Session = require("../ops/Session").Session;
var SessionConstraints = require("./SessionConstraints").SessionConstraints;
var SessionContext = require("./SessionContext").SessionContext;
var EventSource = require("../core/EventSource").EventSource;
var OpApplyHyperlink = require("../ops/OpApplyHyperlink").OpApplyHyperlink;
var OpRemoveHyperlink = require("../ops/OpRemoveHyperlink").OpRemoveHyperlink;
var OpInsertText = require("../ops/OpInsertText").OpInsertText;
var EventNotifier = require("../core/EventNotifier").EventNotifier;
var OpsDocument = require("../ops/Document").Document;
var odfUtils = require("../odf/OdfUtils");
var CommonConstraints = require("./CommonConstraints").CommonConstraints;
var OdtCursor = require("../ops/OdtCursor").OdtCursor;

/**
 * @constructor
 * @implements {Destroyable}
 * @implements {EventSource}
 * @param {!Session} session
 * @param {!SessionConstraints} sessionConstraints
 * @param {!SessionContext} sessionContext
 * @param {!string} inputMemberId
 */
function HyperlinkController(session, sessionConstraints, sessionContext,
        inputMemberId) {
    "use strict";

    var odtDocument = session.getOdtDocument(),
        eventNotifier = new EventNotifier([
            HyperlinkController.enabledChanged
        ]),
        isEnabled = false;

    /**
     * @return {undefined}
     */
    function updateEnabledState() {
        var /**@type{!boolean}*/newIsEnabled = true;

        if (sessionConstraints.getState(CommonConstraints.EDIT.REVIEW_MODE) === true) {
            newIsEnabled = /**@type{!boolean}*/(sessionContext.isLocalCursorWithinOwnAnnotation());
        }

        if (newIsEnabled !== isEnabled) {
            isEnabled = newIsEnabled;
            eventNotifier.emit(HyperlinkController.enabledChanged, isEnabled);
        }
    }

    /**
     * @param {!OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorEvent(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updateEnabledState();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return isEnabled;
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
     * Convert the current selection into a hyperlink
     * @param {!string} hyperlink Hyperlink to insert
     * @param {!string=} insertionText Optional text to insert as the text content for the hyperlink.
     *  Note, the insertion text will not replace the existing selection content.
     */
    function addHyperlink(hyperlink, insertionText) {
        if (!isEnabled) {
            return;
        }
        var selection = odtDocument.getCursorSelection(inputMemberId),
            op = new OpApplyHyperlink(),
            operations = [];

        if (selection.length === 0 || insertionText) {
            insertionText = insertionText || hyperlink;
            op = new OpInsertText();
            op.init({
                memberid: inputMemberId,
                position: selection.position,
                text: insertionText
            });
            selection.length = insertionText.length;
            operations.push(op);
        }

        op = new OpApplyHyperlink();
        op.init({
            memberid: inputMemberId,
            position: selection.position,
            length: selection.length,
            hyperlink: hyperlink
        });
        operations.push(op);
        session.enqueue(operations);
    }
    this.addHyperlink = addHyperlink;

    /**
     * Remove all hyperlinks within the current selection. If a range of text is selected,
     * this will only unlink the selection. If the current selection is collapsed within a
     * link, that entire link will be removed.
     */
    function removeHyperlinks() {
        if (!isEnabled) {
            return;
        }
        
        var iterator = odtDocument.createPositionIterator(odtDocument.getRootNode()),
            selectedRange = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            links = odfUtils.getHyperlinkElements(selectedRange),
            removeEntireLink = selectedRange.collapsed && links.length === 1,
            domRange = odtDocument.getDOMDocument().createRange(),
            operations = [],
            /**@type{{position: !number, length: number}}*/
            cursorRange,
            firstLink, lastLink, offset, op;

        if (links.length === 0) {
            return;
        }

        // Remove any links that overlap with the current selection
        links.forEach(function (link) {
            domRange.selectNodeContents(link);
            cursorRange = odtDocument.convertDomToCursorRange({
                anchorNode: /**@type{!Node}*/(domRange.startContainer),
                anchorOffset: domRange.startOffset,
                focusNode: /**@type{!Node}*/(domRange.endContainer),
                focusOffset: domRange.endOffset
            });
            op = new OpRemoveHyperlink();
            op.init({
                memberid: inputMemberId,
                position: cursorRange.position,
                length: cursorRange.length
            });
            operations.push(op);
        });

        if (!removeEntireLink) {
            // Re-add any leading or trailing links that were only partially selected
            firstLink = /**@type{!Element}*/(links[0]);
            if (selectedRange.comparePoint(firstLink, 0) === -1) {
                domRange.setStart(firstLink, 0);
                domRange.setEnd(selectedRange.startContainer, selectedRange.startOffset);
                cursorRange = odtDocument.convertDomToCursorRange({
                    anchorNode: /**@type{!Node}*/(domRange.startContainer),
                    anchorOffset: domRange.startOffset,
                    focusNode: /**@type{!Node}*/(domRange.endContainer),
                    focusOffset: domRange.endOffset
                });
                if (cursorRange.length > 0) {
                    op = new OpApplyHyperlink();
                    /**@type{!OpApplyHyperlink}*/(op).init({
                        memberid: inputMemberId,
                        position: cursorRange.position,
                        length: cursorRange.length,
                        hyperlink: odfUtils.getHyperlinkTarget(firstLink)
                    });
                    operations.push(op);
                }
            }
            lastLink = /**@type{!Element}*/(links[links.length - 1]);
            iterator.moveToEndOfNode(lastLink);
            offset = iterator.unfilteredDomOffset();
            if (selectedRange.comparePoint(lastLink, offset) === 1) {
                domRange.setStart(selectedRange.endContainer, selectedRange.endOffset);
                domRange.setEnd(lastLink, offset);
                cursorRange = odtDocument.convertDomToCursorRange({
                    anchorNode: /**@type{!Node}*/(domRange.startContainer),
                    anchorOffset: domRange.startOffset,
                    focusNode: /**@type{!Node}*/(domRange.endContainer),
                    focusOffset: domRange.endOffset
                });
                if (cursorRange.length > 0) {
                    op = new OpApplyHyperlink();
                    /**@type{!OpApplyHyperlink}*/(op).init({
                        memberid: inputMemberId,
                        position: cursorRange.position,
                        length: cursorRange.length,
                        hyperlink: odfUtils.getHyperlinkTarget(lastLink)
                    });
                    operations.push(op);
                }
            }
        }

        session.enqueue(operations);
        domRange.detach();
    }
    this.removeHyperlinks = removeHyperlinks;

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(OpsDocument.signalCursorMoved, onCursorEvent);
        sessionConstraints.unsubscribe(CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        callback();
    };

    function init() {
        odtDocument.subscribe(OpsDocument.signalCursorMoved, onCursorEvent);
        sessionConstraints.subscribe(CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        updateEnabledState();
    }
    init();
}

/**@const*/HyperlinkController.enabledChanged = "enabled/changed";
/**@const*/
exports.HyperlinkController = HyperlinkController;
