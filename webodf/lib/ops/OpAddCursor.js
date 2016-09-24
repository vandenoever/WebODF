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
var OdtCursor = require("./OdtCursor").OdtCursor;
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;

/**
 * @constructor
 * @implements op.Operation
 */
function OpAddCursor() {
    "use strict";

    var memberid, timestamp;

    /**
     * @param {!OpAddCursor.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            cursor = odtDocument.getCursor(memberid);

        // there should be none
        if (cursor) {
            return false;
        }

        cursor = new OdtCursor(memberid, odtDocument);
        odtDocument.addCursor(cursor);
        odtDocument.emit(OpsDocument.signalCursorAdded, cursor);
        return true;
    };

    /**
     * @return {!OpAddCursor.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddCursor",
            memberid: memberid,
            timestamp: timestamp
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpAddCursor.InitSpec = function() {}

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpAddCursor.InitSpec}
 */
OpAddCursor.Spec = function() {}
/**@const*/
exports.OpAddCursor = OpAddCursor;
