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
var domUtils = require("../core/DomUtils");
var AnnotationElement = require("../odf/OdfContainer").AnnotationElement;
var Namespaces = require("../odf/Namespaces").Namespaces;

/**
 * @constructor
 * @implements op.Operation
 */
function OpRemoveAnnotation() {
    "use strict";
    var memberid, timestamp,
        /**@type{number}*/
        position,
        /**@type{number}*/
        length;

    /**
     * @param {!OpRemoveAnnotation.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            iterator = odtDocument.getIteratorAtPosition(position),
            container = iterator.container(),
            annotationNode,
            annotationEnd;

        while (!(container.namespaceURI === Namespaces.officens
            && container.localName === 'annotation')) {
            container = container.parentNode;
        }
        if (container === null) {
            return false;
        }

        annotationNode = /**@type{!AnnotationElement}*/(container);
        annotationEnd = annotationNode.annotationEndElement;

        // Untrack and unwrap annotation
        odtDocument.getOdfCanvas().forgetAnnotation(annotationNode);

        /**
         * @param {!Node} node
         */
        function insert(node) {
            /**@type{!Node}*/(annotationNode).parentNode.insertBefore(node, annotationNode);
        }
        // Move all cursors - outside and before the annotation node
        domUtils.getElementsByTagNameNS(annotationNode, 'urn:webodf:names:cursor', 'cursor').forEach(insert);
        domUtils.getElementsByTagNameNS(annotationNode, 'urn:webodf:names:cursor', 'anchor').forEach(insert);

        // Delete start and end
        annotationNode.parentNode.removeChild(annotationNode);
        if (annotationEnd) {
            annotationEnd.parentNode.removeChild(annotationEnd);
        }
        // The specified position is the first walkable step in the annotation. The position is always just before the first point of change
        odtDocument.emit(OdtDocument.signalStepsRemoved, {position: position > 0 ? position - 1 : position});

        odtDocument.getOdfCanvas().rerenderAnnotations();
        odtDocument.fixCursorPositions();
        return true;
    };

    /**
     * @return {!OpRemoveAnnotation.Spec}
     */
    this.spec = function () {
        return {
            optype: "RemoveAnnotation",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpRemoveAnnotation.InitSpec = function() {}
/**@type{!number}*/
OpRemoveAnnotation.InitSpec.prototype.position;
/**@type{!number}*/
OpRemoveAnnotation.InitSpec.prototype.length;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpRemoveAnnotation.InitSpec}
 */
OpRemoveAnnotation.Spec = function() {}

/**@const*/
exports.OpRemoveAnnotation = OpRemoveAnnotation;
