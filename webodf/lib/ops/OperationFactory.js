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

var Operation = require("./Operation").Operation;
var OpAddMember = require("./OpAddMember").OpAddMember;
var OpUpdateMember = require("./OpUpdateMember").OpUpdateMember;
var OpRemoveMember = require("./OpRemoveMember").OpRemoveMember;
var OpAddCursor = require("./OpAddCursor").OpAddCursor;
var OpApplyDirectStyling = require("./OpApplyDirectStyling").OpApplyDirectStyling;
var OpSetBlob = require("./OpSetBlob").OpSetBlob;
var OpRemoveBlob = require("./OpRemoveBlob").OpRemoveBlob;
var OpInsertImage = require("./OpInsertImage").OpInsertImage;
var OpInsertTable = require("./OpInsertTable").OpInsertTable;
var OpInsertText = require("./OpInsertText").OpInsertText;
var OpRemoveText = require("./OpRemoveText").OpRemoveText;
var OpMergeParagraph = require("./OpMergeParagraph").OpMergeParagraph;
var OpSplitParagraph = require("./OpSplitParagraph").OpSplitParagraph;
var OpSetParagraphStyle = require("./OpSetParagraphStyle").OpSetParagraphStyle;
var OpUpdateParagraphStyle = require("./OpUpdateParagraphStyle").OpUpdateParagraphStyle;
var OpAddStyle = require("./OpAddStyle").OpAddStyle;
var OpRemoveStyle = require("./OpRemoveStyle").OpRemoveStyle;
var OpMoveCursor = require("./OpMoveCursor").OpMoveCursor;
var OpRemoveCursor = require("./OpRemoveCursor").OpRemoveCursor;
var OpAddAnnotation = require("./OpAddAnnotation").OpAddAnnotation;
var OpRemoveAnnotation = require("./OpRemoveAnnotation").OpRemoveAnnotation;
var OpUpdateMetadata = require("./OpUpdateMetadata").OpUpdateMetadata;
var OpApplyHyperlink = require("./OpApplyHyperlink").OpApplyHyperlink;
var OpRemoveHyperlink = require("./OpRemoveHyperlink").OpRemoveHyperlink;

/*
 * create specific operation instances.
 */

/**
 * @constructor
 */
function OperationFactory() {
    "use strict";
    var /**@type{!Object.<!string, !OperationFactory.SpecConstructor>}*/
        specs;

    /**
     * @param {!function(new:Operation)} Constructor
     * @return {!OperationFactory.SpecConstructor}
     */
    /*jslint unparam:true*/
    function construct(Constructor) {
        return function(spec) {
            return new Constructor();
        };
    }
    /*jslint unparam:false*/

    /**
     * Registers an operation constructor with this operation factory
     * @param {!string} specName
     * @param {!OperationFactory.SpecConstructor} specConstructor
     * @return {undefined}
     */
    this.register = function (specName, specConstructor) {
        specs[specName] = specConstructor;
    };

    /**
     * Create an instance of an operation based on the provided spec
     * @param {!{optype:string}} spec
     * @return {Operation}
     */
    this.create = function (spec) {
        var /**@type{Operation}*/
            op = null,
            constructor = specs[spec.optype];
        if (constructor) {
            op = constructor(spec);
            op.init(spec);
        }
        return op;
    };

    function init() {
        specs = {
            AddMember: construct(OpAddMember),
            UpdateMember: construct(OpUpdateMember),
            RemoveMember: construct(OpRemoveMember),
            AddCursor: construct(OpAddCursor),
            ApplyDirectStyling: construct(OpApplyDirectStyling),
            SetBlob: construct(OpSetBlob),
            RemoveBlob: construct(OpRemoveBlob),
            InsertImage: construct(OpInsertImage),
            InsertTable: construct(OpInsertTable),
            InsertText: construct(OpInsertText),
            RemoveText: construct(OpRemoveText),
            MergeParagraph: construct(OpMergeParagraph),
            SplitParagraph: construct(OpSplitParagraph),
            SetParagraphStyle: construct(OpSetParagraphStyle),
            UpdateParagraphStyle: construct(OpUpdateParagraphStyle),
            AddStyle: construct(OpAddStyle),
            RemoveStyle: construct(OpRemoveStyle),
            MoveCursor: construct(OpMoveCursor),
            RemoveCursor: construct(OpRemoveCursor),
            AddAnnotation: construct(OpAddAnnotation),
            RemoveAnnotation: construct(OpRemoveAnnotation),
            UpdateMetadata: construct(OpUpdateMetadata),
            ApplyHyperlink: construct(OpApplyHyperlink),
            RemoveHyperlink: construct(OpRemoveHyperlink)
        };
    }

    init();
}

/**
 * @typedef {!function(!{optype:!string}):!Operation}
 */
OperationFactory.SpecConstructor;
/**@const*/
exports.OperationFactory = OperationFactory;
