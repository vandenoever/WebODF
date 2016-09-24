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

var op = require("./Operation");
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;
var OdtCursor = require("./OdtCursor").OdtCursor;

/**
 * @constructor
 * @implements op.Operation
 */
function OpMoveCursor() {
    "use strict";

    var memberid, timestamp, position, length, /**@type {!string}*/selectionType;

    /**
     * @param {!OpMoveCursor.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length || 0;
        selectionType = data.selectionType || OdtCursor.RangeSelection;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            cursor = odtDocument.getCursor(memberid),
            selectedRange;

        if (!cursor) {
            return false;
        }

        selectedRange = odtDocument.convertCursorToDomRange(position, length);
        cursor.setSelectedRange(selectedRange, length >= 0);
        cursor.setSelectionType(selectionType);
        odtDocument.emit(OpsDocument.signalCursorMoved, cursor);
        return true;
    };

    /**
     * @return {!OpMoveCursor.Spec}
     */
    this.spec = function () {
        return {
            optype: "MoveCursor",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            selectionType: selectionType
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpMoveCursor.InitSpec = function() {}
/**@type{!number}*/
OpMoveCursor.InitSpec.prototype.position;
/**@type{!number}*/
OpMoveCursor.InitSpec.prototype.length;
/**@type{(!string|undefined)}*/
OpMoveCursor.InitSpec.prototype.selectionType;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpMoveCursor.InitSpec}
 */
OpMoveCursor.Spec = function() {}

/**@const*/
exports.OpMoveCursor = OpMoveCursor;
