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

var Document = require("./Document").Document;

/*jslint emptyblock: true, unparam: true*/

/**
 * An operation that can be performed on a document.
 * @interface
 */
function Operation() {
    "use strict";
}

/**
 * @param {?} data
 * @return {undefined}
 */
Operation.prototype.init = function (data) {"use strict"; };

/**
 * This is meant to indicate whether
 * the operation is an 'edit', i.e.
 * causes any changes that would make
 * it into the saved ODF.
 * @type {!boolean}
 */
Operation.prototype.isEdit;

/**
 * @type {string}
 */
Operation.prototype.group;

/**
 * @param {!Document} document
 * @return {!boolean} true if the operation was executed
 */
Operation.prototype.execute = function (document) {"use strict"; };

/**@record*/
function SpecBase() {}
/**@type{!string}*/
SpecBase.prototype.memberid;
/**@type{!number|undefined}*/
SpecBase.prototype.timestamp;

/**
 * @record
 * @extends SpecBase
 */
function TypedOperationSpec() {}
/**@type{string}*/
TypedOperationSpec.prototype.optype;

/**
 * @return {!TypedOperationSpec}
 */
Operation.prototype.spec = function () {"use strict"; };

/**@const*/
exports.Operation = Operation;
/**@const*/
exports.SpecBase = SpecBase;
/**@const*/
exports.TypedOperationSpec = TypedOperationSpec;
