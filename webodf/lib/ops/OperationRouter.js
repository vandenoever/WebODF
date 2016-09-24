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

var Operation = require("./Operation").Operation;
var OperationFactory = require("./OperationFactory").OperationFactory;

/*jslint emptyblock: true, unparam: true*/

/**
 * @interface
 */
function OperationRouter() {"use strict"; }

/**
 * Sets the factory to use to create operation instances from operation specs.
 *
 * @param {!OperationFactory} f
 * @return {undefined}
 */
OperationRouter.prototype.setOperationFactory = function (f) {"use strict"; };

/**
 * Sets the method which should be called to apply operations.
 *
 * @param {!function(!Operation):boolean} playback_func
 * @return {undefined}
 */
OperationRouter.prototype.setPlaybackFunction = function (playback_func) {"use strict"; };

/**
 * Brings the locally created operations into the game.
 * The ops are guaranteed to be executed directly after each other, in the given order
 * (first will be executed first).
 * TODO: currently all known implementations only use the specs of the operations,
 * so it might make sense to not create any operations outside of the operation router at all
 * and instead just create specs and pass them to this push method?
 *
 * @param {!Array.<!Operation>} operations
 * @return {undefined}
 */
OperationRouter.prototype.push = function (operations) {"use strict"; };

/**
 * Requests a gracefull shutdown of the Operation Router.
 * Buffered operations shall be sent to the master session (if any).
 * A callback is called, getting passed an error object in case of error.
 *
 * @param {!function(!Object=)} callback
 * @return {undefined}
 */
OperationRouter.prototype.close = function (callback) {"use strict"; };

/**
 * The passed cb will be called on every event of type eventId.
 *
 * @param {!string} eventId
 * @param {!Function} cb
 * @return {undefined}
 */
OperationRouter.prototype.subscribe = function (eventId, cb) {"use strict"; };

/**
 * Undoes the subscription done with subscribe(...).
 *
 * @param {!string} eventId
 * @param {!Function} cb
 * @return {undefined}
 */
OperationRouter.prototype.unsubscribe = function (eventId, cb) {"use strict"; };

/**
 * Returns if there are operations done locally that have not yet been
 * synchronized with the host of the session.
 *
 * @return {!boolean}
 */
OperationRouter.prototype.hasLocalUnsyncedOps = function () {"use strict"; };

/**
 * Returns if the connection to the host of the session is currently existing.
 *
 * @return {!boolean}
 */
OperationRouter.prototype.hasSessionHostConnection = function () {"use strict"; };

/**
 * Signal that the operation router is about to process a batch of operations.
 * @const
 * @type {string}
 */
OperationRouter.signalProcessingBatchStart = "router/batchstart";

/**
 * Signal that the operation router has just completed processing a batch of operations.
 * @const
 * @type {string}
 */
OperationRouter.signalProcessingBatchEnd = "router/batchend";
/**@const*/
exports.OperationRouter = OperationRouter;
