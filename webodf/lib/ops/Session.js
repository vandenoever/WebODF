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

var Destroyable = require("../core/Destroyable").Destroyable;
var OdfCanvas = require("../odf/OdfCanvas").OdfCanvas;
var OdtDocument = require("./OdtDocument").OdtDocument;
var Operation = require("./Operation").Operation;
var OperationFactory = require("./OperationFactory").OperationFactory;
var OperationRouter = require("./TrivialOperationRouter").TrivialOperationRouter;
var TrivialOperationRouter = require("./TrivialOperationRouter").TrivialOperationRouter;

/**
 * An editing session and what belongs to it.
 * @constructor
 * @implements {Destroyable}
 * @param {!OdfCanvas} odfCanvas
 */
function Session(odfCanvas) {
    "use strict";
    var self = this,
        /**@type{!OperationFactory}*/
        operationFactory = new OperationFactory(),
        /**@type{!OdtDocument}*/
        odtDocument = new OdtDocument(odfCanvas),
        /**@type{?OperationRouter}*/
        operationRouter = null;

    /**
     * Forward the router's batch start signal on to the document
     * @param {*} args
     * @return {undefined}
     */
    function forwardBatchStart(args) {
        odtDocument.emit(OdtDocument.signalProcessingBatchStart, args);
    }

    /**
     * Forward the router's batch end signal on to the document
     * @param {*} args
     * @return {undefined}
     */
    function forwardBatchEnd(args) {
        odtDocument.emit(OdtDocument.signalProcessingBatchEnd, args);
    }

    /**
     * @param {!OperationFactory} opFactory
     */
    this.setOperationFactory = function (opFactory) {
        operationFactory = opFactory;
        if (operationRouter) {
            operationRouter.setOperationFactory(operationFactory);
        }
    };

    /**
     * @param {!OperationRouter} opRouter
     * @return {undefined}
     */
    this.setOperationRouter = function (opRouter) {
        if (operationRouter) {
            operationRouter.unsubscribe(OperationRouter.signalProcessingBatchStart, forwardBatchStart);
            operationRouter.unsubscribe(OperationRouter.signalProcessingBatchEnd, forwardBatchEnd);
        }
        operationRouter = opRouter;
        operationRouter.subscribe(OperationRouter.signalProcessingBatchStart, forwardBatchStart);
        operationRouter.subscribe(OperationRouter.signalProcessingBatchEnd, forwardBatchEnd);
        opRouter.setPlaybackFunction(function (op) {
            odtDocument.emit(OdtDocument.signalOperationStart, op);
            if (op.execute(odtDocument)) {
                odtDocument.emit(OdtDocument.signalOperationEnd, op);
                return true;
            }
            return false;
        });
        opRouter.setOperationFactory(operationFactory);
    };

    /**
     * @return {!OperationFactory}
     */
    this.getOperationFactory = function () {
        return operationFactory;
    };

    /**
     * @return {!OdtDocument}
     */
    this.getOdtDocument = function () {
        return odtDocument;
    };

    /**
     * Controller sends operations to this method.
     *
     * @param {!Array.<!Operation>} ops
     * @return {undefined}
     */
    this.enqueue = function (ops) {
        operationRouter.push(ops);
    };

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.close = function (callback) {
        /**
         * @param {!Object=} err
         */
        function cb(err) {
            if (err) {
                callback(err);
            } else {
                odtDocument.close(callback);
            }
        }
        operationRouter.close(cb);
    };

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        /*
        operationRouter.destroy(function(err) {
            if (err) {
                callback(err);
            } else {
                memberModel.destroy(function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        */
                        odtDocument.destroy(callback);
                        /*
                    }
                });
            }
        });
        */
    };

    /**
     * @return {undefined}
     */
    function init() {
        self.setOperationRouter(new TrivialOperationRouter());
    }
    init();
}
/**@const*/
exports.Session = Session;
