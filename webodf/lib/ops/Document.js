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

var PositionFilter = require("../core/PositionFilter").PositionFilter;
var PositionIterator = require("../core/PositionIterator").PositionIterator;
var Canvas = require("./Canvas").Canvas;

/*jslint emptyblock: true, unparam: true */

/**
 * A document that keeps all data related to the mapped document.
 * @interface
 */
function OpsDocument() { "use strict"; }
/**
 * @return {!Array.<string>}
 */
OpsDocument.prototype.getMemberIds = function () { "use strict"; };
/**
 * @param {!string} memberid
 * @return {!boolean}
 */
OpsDocument.prototype.removeCursor = function (memberid) { "use strict"; };
/**
 * @return {!Element}
 */
OpsDocument.prototype.getDocumentElement = function () { "use strict"; };
/**
 * Return the element where the document content begins.
 * Document content means the body of the document. In the case of ODF this is
 * office:text, office:spreadsheet, office:presentation. For most XML documents
 * getRootNode() will return the same node as getDocumentElement().
 * @return {!Element}
 */
OpsDocument.prototype.getRootNode = function () { "use strict"; };
/**
 * @return {!Document}
 */
OpsDocument.prototype.getDOMDocument = function () { "use strict"; };
/**
 * @return {!Element}
 */
OpsDocument.prototype.cloneDocumentElement = function () { "use strict"; };
/**
 * @param {!Element} element
 * @return {undefined}
 */
OpsDocument.prototype.setDocumentElement = function (element) { "use strict"; };
/**
 * @param {!string} eventid
 * @param {!Function} cb
 * @return {undefined}
 */
OpsDocument.prototype.subscribe = function (eventid, cb) { "use strict"; };
/**
 * @param {!string} eventid
 * @param {!Function} cb
 * @return {undefined}
 */
OpsDocument.prototype.unsubscribe = function (eventid, cb) { "use strict"; };
// vim:expandtab
/**
 * @return {!Canvas}
 */
OpsDocument.prototype.getCanvas = function () { "use strict"; };
/**
 * @param {string|!Node} inputMemberId
 * @return {!PositionFilter}
 */
OpsDocument.prototype.createRootFilter = function (inputMemberId) { "use strict"; };
/**
 * @param {!Node} rootNode
 * @return {!PositionIterator}
 */
OpsDocument.prototype.createPositionIterator = function (rootNode) { "use strict"; };
/**
 * @param {!string} memberid
 * @return {!boolean}
 */
OpsDocument.prototype.hasCursor = function (memberid) { "use strict"; };

/**@const*/
OpsDocument.signalCursorAdded =   "cursor/added";
/**@const*/
OpsDocument.signalCursorRemoved = "cursor/removed";
/**@const*/
OpsDocument.signalCursorMoved =   "cursor/moved";
/**@const*/
OpsDocument.signalMemberAdded =   "member/added";
/**@const*/
OpsDocument.signalMemberUpdated = "member/updated";
/**@const*/
OpsDocument.signalMemberRemoved = "member/removed";
/**@const*/
exports.Document = OpsDocument;
