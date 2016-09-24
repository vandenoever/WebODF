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

/**
 * @constructor
 * @implements op.Operation
 */
function OpSetBlob() {
    "use strict";

    var memberid, timestamp, filename, mimetype, content;

    /**
     * @param {!OpSetBlob.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        filename = data.filename;
        mimetype = data.mimetype;
        content = data.content;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document);
        odtDocument.getOdfCanvas().odfContainer().setBlob(filename, mimetype, content);
        return true;
    };

    /**
     * @return {!OpSetBlob.Spec}
     */
    this.spec = function () {
        return {
            optype: "SetBlob",
            memberid: memberid,
            timestamp: timestamp,
            filename: filename,
            mimetype: mimetype,
            content: content
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpSetBlob.InitSpec = function() {}
/**@type{!string}*/
OpSetBlob.InitSpec.prototype.filename;
/**@type{!string}*/
OpSetBlob.InitSpec.prototype.mimetype;
/**@type{!string}*/
OpSetBlob.InitSpec.prototype.content;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpSetBlob.InitSpec}
 */
OpSetBlob.Spec = function() {}

/**@const*/
exports.OpSetBlob = OpSetBlob;
