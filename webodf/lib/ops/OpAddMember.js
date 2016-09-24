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

var op = require("./Operation");
var OdtCursor = require("./OdtCursor").OdtCursor;
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;
var m = require("./Member");

/**
 * OpAddMember has 3 required properties:
 * fullName, color, and imageUrl. Because the
 * spec does not expose those explicitly right now,
 * internally these properties are set as
 * runtime.tr("Unknown Author"), 'black', and "avatar-joe.png"
 * respectively, if unspecified.
 * @constructor
 * @implements op.Operation
 */
function OpAddMember() {
    "use strict";

    var memberid, timestamp, setProperties;
    /**
     * @param {!OpAddMember.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        setProperties = data.setProperties;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            member;
        if (odtDocument.getMember(memberid)) {
            return false;
        }

        member = new m.Member(memberid, setProperties);
        odtDocument.addMember(member);
        odtDocument.emit(OpsDocument.signalMemberAdded, member);

        return true;
    };

    /**
     * @return {!OpAddMember.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddMember",
            memberid: memberid,
            timestamp: timestamp,
            setProperties: setProperties
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpAddMember.InitSpec = function() {}
/**@type{!m.MemberProperties}*/
OpAddMember.InitSpec.prototype.setProperties;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpAddMember.InitSpec}
 */
OpAddMember.Spec = function() {}

/**@const*/
exports.OpAddMember = OpAddMember;
