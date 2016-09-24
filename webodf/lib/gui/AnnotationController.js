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
var EventNotifier = require("../core/EventNotifier").EventNotifier;
var OpAddAnnotation = require("../ops/OpAddAnnotation").OpAddAnnotation;
var OpRemoveAnnotation = require("../ops/OpRemoveAnnotation").OpRemoveAnnotation;
var OpMoveCursor = require("../ops/OpMoveCursor").OpMoveCursor;
var OpsDocument = require("../ops/Document").Document;
var Session = require("../ops/Session").Session;
var OdtCursor = require("../ops/OdtCursor").OdtCursor;
var StepDirection = require("../core/enums").StepDirection;
var odfUtils = require("../odf/OdfUtils");
var CommonConstraints = require("./CommonConstraints").CommonConstraints;
var SessionConstraints = require("./SessionConstraints").SessionConstraints;

/**
 * @constructor
 * @implements {Destroyable}
 * @param {!Session} session
 * @param {!SessionConstraints} sessionConstraints
 * @param {!string} inputMemberId
 */
function AnnotationController(session, sessionConstraints, inputMemberId) {
    "use strict";

    var odtDocument = session.getOdtDocument(),
        isAnnotatable = false,
        eventNotifier = new EventNotifier([AnnotationController.annotatableChanged]),
        /**@const*/
        NEXT = StepDirection.NEXT;

    /**
     * @return {undefined}
     */
    function updatedCachedValues() {
        var cursor = odtDocument.getCursor(inputMemberId),
            cursorNode = cursor && cursor.getNode(),
            newIsAnnotatable = false;
        if (cursorNode) {
            newIsAnnotatable = !odfUtils.isWithinAnnotation(cursorNode, odtDocument.getRootNode());
        }

        if (newIsAnnotatable !== isAnnotatable) {
            isAnnotatable = newIsAnnotatable;
            eventNotifier.emit(AnnotationController.annotatableChanged, isAnnotatable);
        }
    }

    /**
     * @param {!OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorAdded(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function onCursorRemoved(memberId) {
        if (memberId === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorMoved(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isAnnotatable = function () {
        return isAnnotatable;
    };

    /**
     * Adds an annotation to the document based on the current selection
     * @return {undefined}
     */
    this.addAnnotation = function () {
        var op = new OpAddAnnotation(),
            selection = odtDocument.getCursorSelection(inputMemberId),
            length = selection.length,
            position = selection.position;

        if (!isAnnotatable) {
            return;
        }

        if (length === 0) {
            length = undefined;
        } else {
            position = length >= 0 ? position : position + length;
            length = Math.abs(length);
        }

        op.init({
            memberid: inputMemberId,
            position: position,
            length: length,
            name: inputMemberId + Date.now()
        });
        session.enqueue([op]);
    };


    /**
     * @param {!Element} annotationNode
     * @return {undefined}
     */
    this.removeAnnotation = function(annotationNode) {
        var startStep, endStep, op, moveCursor,
            currentUserName = odtDocument.getMember(inputMemberId).getProperties().fullName;

        if (sessionConstraints.getState(CommonConstraints.EDIT.ANNOTATIONS.ONLY_DELETE_OWN) === true) {
            if (currentUserName !== odfUtils.getAnnotationCreator(annotationNode)) {
                return;
            }
        }

        // round up to get the first step within the annotation node
        startStep = odtDocument.convertDomPointToCursorStep(annotationNode, 0, NEXT);
        // Will report the last walkable step within the annotation
        endStep = odtDocument.convertDomPointToCursorStep(annotationNode, annotationNode.childNodes.length);

        op = new OpRemoveAnnotation();
        op.init({
            memberid: inputMemberId,
            position: startStep,
            length: endStep - startStep
        });
        moveCursor = new OpMoveCursor();
        moveCursor.init({
            memberid: inputMemberId,
            position: startStep > 0 ? startStep - 1 : startStep, // Last position just before the annotation starts
            length: 0
        });
        session.enqueue([op, moveCursor]);
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
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        odtDocument.unsubscribe(OpsDocument.signalCursorAdded, onCursorAdded);
        odtDocument.unsubscribe(OpsDocument.signalCursorRemoved, onCursorRemoved);
        odtDocument.unsubscribe(OpsDocument.signalCursorMoved, onCursorMoved);
        callback();
    };

    function init() {
        sessionConstraints.registerConstraint(CommonConstraints.EDIT.ANNOTATIONS.ONLY_DELETE_OWN);

        odtDocument.subscribe(OpsDocument.signalCursorAdded, onCursorAdded);
        odtDocument.subscribe(OpsDocument.signalCursorRemoved, onCursorRemoved);
        odtDocument.subscribe(OpsDocument.signalCursorMoved, onCursorMoved);
        updatedCachedValues();
    }

    init();
}

/**@const*/AnnotationController.annotatableChanged = "annotatable/changed";
/**@const*/
exports.AnnotationController = AnnotationController;
