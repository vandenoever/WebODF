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
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;
var Namespaces = require("../odf/Namespaces").Namespaces;
var xpath = require("../xmldom/XPath");
var MemberProperties = require("./Member").MemberProperties;

/**
 * OpUpdateMember allows you to set and remove
 * certain properties.
 * 'fullName', 'color', and 'imageUrl' are not
 * removable, they will be filtered out of 
 * removedProperties if found.
 * @constructor
 * @implements op.Operation
 */
function OpUpdateMember() {
    "use strict";

    var /**@type{string}*/
        memberid,
        timestamp,
        /**@type{MemberProperties}*/
        setProperties,
        removedProperties;

    /**
     * @param {!OpUpdateMember.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = parseInt(data.timestamp, 10);
        setProperties = data.setProperties;
        removedProperties = data.removedProperties;
    };

    this.isEdit = false;
    this.group = undefined;

    /**
     * @param {!OdtDocument} doc
     */
    function updateCreators(doc) {
        var xp = "//dc:creator[@editinfo:memberid='" + memberid + "']",
            creators = xpath.getODFElementsWithXPath(doc.getRootNode(), xp, function (prefix) {
                if (prefix === "editinfo") {
                    return "urn:webodf:names:editinfo";
                }
                return Namespaces.lookupNamespaceURI(prefix);
            }),
            i;

        for (i = 0; i < creators.length; i += 1) {
            creators[i].textContent = setProperties.fullName;
        }
    }

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            member = odtDocument.getMember(memberid);
        if (!member) {
            return false;
        }

        if (removedProperties) {
            member.removeProperties(removedProperties);
        }
        if (setProperties) {
            member.setProperties(setProperties);
            if (setProperties.fullName) {
                updateCreators(odtDocument);
            }
        }

        odtDocument.emit(OpsDocument.signalMemberUpdated, member);
        return true;
    };

    /**
     * @return {!OpUpdateMember.Spec}
     */
    this.spec = function () {
        return {
            optype: "UpdateMember",
            memberid: memberid,
            timestamp: timestamp,
            setProperties: setProperties,
            removedProperties: removedProperties
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpUpdateMember.InitSpec = function() {}
/**@type{?MemberProperties}*/
OpUpdateMember.InitSpec.prototype.setProperties;
/**@type{!Object}*/
OpUpdateMember.InitSpec.prototype.removedProperties;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpUpdateMember.InitSpec}
 */
OpUpdateMember.Spec = function() {}

/**@const*/
exports.OpUpdateMember = OpUpdateMember;
