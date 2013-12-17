/**
 * Copyright (C) 2012,2013 KO GmbH <jos.van.den.oever@kogmbh.com>
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, Runtime, core, Node, Element*/

/*jslint evil: true, continue: true, emptyblock: true, unparam: true*/
/**
 * @typedef{{f:function(),name:!string}}
 */
core.NamedFunction;
/**
 * @typedef{{f:function(function()),name:!string}}
 */
core.NamedAsyncFunction;
/**
 * @interface
 */
core.UnitTest = function UnitTest() {"use strict"; };
/**
 * @return {undefined}
 */
core.UnitTest.prototype.setUp = function () {"use strict"; };
/**
 * @return {undefined}
 */
core.UnitTest.prototype.tearDown = function () {"use strict"; };
/**
 * @return {!string}
 */
core.UnitTest.prototype.description = function () {"use strict"; };
/**
 * @return {!Array.<!core.NamedFunction>}
 */
core.UnitTest.prototype.tests = function () {"use strict"; };
/**
 * @return {!Array.<!core.NamedAsyncFunction>}
 */
core.UnitTest.prototype.asyncTests = function () {"use strict"; };

/**
 * @return {!HTMLDivElement}
 */
core.UnitTest.provideTestAreaDiv = function () {
    "use strict";
    var maindoc = runtime.getWindow().document,
        testarea = maindoc.getElementById('testarea');

    runtime.assert(!testarea, "Unclean test environment, found a div with id \"testarea\".");

    testarea = maindoc.createElement('div');
    testarea.setAttribute('id', 'testarea');
    maindoc.body.appendChild(testarea);
    return /**@type{!HTMLDivElement}*/(testarea);
};

/**
 * @return {undefined}
 */
core.UnitTest.cleanupTestAreaDiv = function () {
    "use strict";
    var maindoc = runtime.getWindow().document,
        testarea = maindoc.getElementById('testarea');

    runtime.assert((!!testarea && (testarea.parentNode === maindoc.body)), "Test environment broken, found no div with id \"testarea\" below body.");
    maindoc.body.removeChild(testarea);
};

/**
 * Creates and returns a simple ODT document
 * @param {!string} xml Xml fragment to insert in the document between the
 *                      <office:document>..</office:document> tags
 * @param {!Object.<string, string>} namespaceMap Name-value pairs that map the
 *                                   prefix onto the appropriate uri namespace
 * @returns {?Document}
 */
core.UnitTest.createOdtDocument = function (xml, namespaceMap) {
    "use strict";
    var /**@type{!string}*/
        xmlDoc = "<?xml version='1.0' encoding='UTF-8'?>";

    xmlDoc += "<office:document";
    Object.keys(namespaceMap).forEach(function (key) {
        xmlDoc += " xmlns:" + key + '="' + namespaceMap[key] + '"';
    });
    xmlDoc += ">";
    xmlDoc += xml;
    xmlDoc += "</office:document>";

    return runtime.parseXML(xmlDoc);
};

/**
 * @constructor
 */
core.UnitTestRunner = function UnitTestRunner() {
    "use strict";
    var /**@type{!number}*/
        failedTests = 0,
        areObjectsEqual;
    /**
     * @param {!string} msg
     * @return {undefined}
     */
    function debug(msg) {
        runtime.log(msg);
    }
    /**
     * @param {!string} msg
     * @return {undefined}
     */
    function testFailed(msg) {
        failedTests += 1;
        runtime.log("fail", msg);
    }
    /**
     * @param {!string} msg
     * @return {undefined}
     */
    function testPassed(msg) {
        runtime.log("pass", msg);
    }
    /**
     * @param {!Array.<*>} a actual
     * @param {!Array.<*>} b expected
     * @return {!boolean}
     */
    function areArraysEqual(a, b) {
        var i;
        try {
            if (a.length !== b.length) {
                testFailed("array of length " + a.length + " should be "
                           + b.length + " long");
                return false;
            }
            for (i = 0; i < a.length; i += 1) {
                if (a[i] !== b[i]) {
                    testFailed(a[i] + " should be " + b[i] + " at array index "
                               + i);
                    return false;
                }
            }
        } catch (ex) {
            return false;
        }
        return true;
    }
    /**
     * @param {!Element} a actual
     * @param {!Element} b expected
     * @param {!boolean} skipReverseCheck
     * @return {!boolean}
     */
    function areAttributesEqual(a, b, skipReverseCheck) {
        var aatts = a.attributes,
            n = aatts.length,
            i,
            att,
            v;
        for (i = 0; i < n; i += 1) {
            att = /**@type{!Attr}*/(aatts.item(i));
            if (att.prefix !== "xmlns" && att.namespaceURI !== "urn:webodf:names:steps") {
                v = b.getAttributeNS(att.namespaceURI, att.localName);
                if (!b.hasAttributeNS(att.namespaceURI, att.localName)) {
                    testFailed("Attribute " + att.localName + " with value " + att.value + " was not present");
                    return false;
                }
                if (v !== att.value) {
                    testFailed("Attribute " + att.localName + " was " + v + " should be " + att.value);
                    return false;
                }
            }
        }
        return skipReverseCheck ? true : areAttributesEqual(b, a, true);
    }
    /**
     * @param {!Node} a actual
     * @param {!Node} b expected
     * @return {!boolean}
     */
    function areNodesEqual(a, b) {
        var an, bn,
            atype = a.nodeType,
            btype = b.nodeType;
        if (atype !== btype) {
            testFailed("Nodetype '" + atype + "' should be '" + btype + "'");
            return false;
        }
        if (atype === Node.TEXT_NODE) {
            if (/**@type{!Text}*/(a).data === /**@type{!Text}*/(b).data) {
                return true;
            }
            testFailed("Textnode data '" + /**@type{!Text}*/(a).data
                       +  "' should be '" + /**@type{!Text}*/(b).data + "'");
            return false;
        }
        runtime.assert(atype === Node.ELEMENT_NODE
                || atype === Node.DOCUMENT_FRAGMENT_NODE,
            "Only textnodes, elements and fragments supported.");
        if (a.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            while (an) {
                if (!bn) {
                    testFailed("Number of children is not equal.");
                    return false;
                }
                if (!areNodesEqual(an, bn)) {
                    return false;
                }
                an = an.nextSibling;
                bn = bn.nextSibling;
            }
            if (bn) {
                testFailed("Number of children is not equal.");
                return false;
            }
            return true;
        }
        runtime.assert(a.nodeType === Node.ELEMENT_NODE, "Only textnodes, elements and documentFragments are supported.");
        if (a.namespaceURI !== b.namespaceURI) {
            testFailed("namespace '" + a.namespaceURI + "' should be '"
                    + b.namespaceURI + "'");
            return false;
        }
        if (a.localName !== b.localName) {
            testFailed("localName '" + a.localName + "' should be '" + b.localName + "'");
            return false;
        }
        if (!areAttributesEqual(/**@type{!Element}*/(a),
                                /**@type{!Element}*/(b), false)) {
            return false;
        }
        an = a.firstChild;
        bn = b.firstChild;
        while (an) {
            if (!bn) {
                testFailed("Nodetype '" + an.nodeType + "' is unexpected here.");
                return false;
            }
            if (!areNodesEqual(an, bn)) {
                return false;
            }
            an = an.nextSibling;
            bn = bn.nextSibling;
        }
        if (bn) {
            testFailed("Nodetype '" + bn.nodeType + "' is missing here.");
            return false;
        }
        return true;
    }
    /**
     * @param {!*} actual
     * @param {!*} expected
     * @return {!boolean}
     */
    function isResultCorrect(actual, expected) {
        if (expected === 0) {
            return actual === expected && (1 / actual) === (1 / expected);
        }
        if (actual === expected) {
            return true;
        }
        if (typeof expected === "number" && isNaN(expected)) {
            return typeof actual === "number" && isNaN(actual);
        }
        if (Object.prototype.toString.call(expected) ===
                Object.prototype.toString.call([])) {
            return areArraysEqual(/**@type{!Array}*/(actual),
                                  /**@type{!Array}*/(expected));
        }
        if (typeof expected === "object" && typeof actual === "object") {
            if (/**@type{!Object}*/(expected).constructor === Element
                    || /**@type{!Object}*/(expected).constructor === Node) {
                return areNodesEqual(/**@type{!Node}*/(actual),
                                     /**@type{!Node}*/(expected));
            }
            return areObjectsEqual(/**@type{!Object}*/(actual),
                                   /**@type{!Object}*/(expected));
        }
        return false;
    }
    /**
     * @param {*} v
     * @return {!string}
     */
    function stringify(v) {
        if (v === 0 && 1 / v < 0) {
            return "-0";
        }
        return String(v);
    }
    /**
     * @param {!Object} t
     * @param {!string} a
     * @param {!string} b
     * @return {undefined}
     */
    function shouldBe(t, a, b) {
        if (typeof a !== "string" || typeof b !== "string") {
            debug("WARN: shouldBe() expects string arguments");
        }
        var exception, av, bv;
        try {
            av = eval(a);
        } catch (/**@type{*}*/e) {
            exception = e;
        }
        bv = eval(b);

        if (exception) {
            testFailed(a + " should be " + bv + ". Threw exception " +
                    exception);
        } else if (isResultCorrect(av, bv)) {
            testPassed(a + " is " + b);
        } else if (String(typeof av) === String(typeof bv)) {
            testFailed(a + " should be " + bv + ". Was " + stringify(av) + ".");
        } else {
            testFailed(a + " should be " + bv + " (of type " + typeof bv +
                    "). Was " + av + " (of type " + typeof av + ").");
        }
    }
    /**
     * @param {!Object} t context in which values to be tested are placed
     * @param {!string} a the value to be checked
     * @return {undefined}
     */
    function shouldBeNonNull(t, a) {
        var exception, av;
        try {
            av = eval(a);
        } catch (/**@type{*}*/e) {
            exception = e;
        }

        if (exception) {
            testFailed(a + " should be non-null. Threw exception " + exception);
        } else if (av !== null) {
            testPassed(a + " is non-null.");
        } else {
            testFailed(a + " should be non-null. Was " + av);
        }
    }
    /**
     * @param {!Object} t context in which values to be tested are placed
     * @param {!string} a the value to be checked
     * @return {undefined}
     */
    function shouldBeNull(t, a) {
        shouldBe(t, a, "null");
    }

    /**
     * @param {!Object} a
     * @param {!Object} b
     * @return {!boolean}
     */
    areObjectsEqual = function (a, b) {
        var akeys = Object.keys(a),
            bkeys = Object.keys(b);
        akeys.sort();
        bkeys.sort();
        return areArraysEqual(akeys, bkeys)
            && Object.keys(a).every(function (key) {
                var /**@type{*}*/
                    aval = a[key],
                    /**@type{*}*/
                    bval = b[key];
                if (!isResultCorrect(aval, bval)) {
                    testFailed(aval + " should be " + bval + " for key " + key);
                    return false;
                }
                return true;
            });
    };

    this.areNodesEqual = areNodesEqual;
    this.shouldBeNull = shouldBeNull;
    this.shouldBeNonNull = shouldBeNonNull;
    this.shouldBe = shouldBe;
    /**
     * @return {!number}
     */
    this.countFailedTests = function () {
        return failedTests;
    };
    /**
     * @param {!Array.<T>} functions
     * @return {!Array.<!{f:T,name:string}>}
     * @template T
     */
    this.name = function (functions) {
        var i, fname,
            nf = [],
            l = functions.length;
        nf.length = l;
        for (i = 0; i < l; i += 1) {
            fname = Runtime.getFunctionName(functions[i]) || "";
            if (fname === "") {
                throw "Found a function without a name.";
            }
            nf[i] = {f: functions[i], name: fname};
        }
        return nf;
    };
};

/**
 * @constructor
 */
core.UnitTester = function UnitTester() {
    "use strict";
    var /**@type{!number}*/
        failedTests = 0,
        results = {};
    /**
     * @param {!string} text
     * @param {!string} code
     * @return {!string}
     **/
    function link(text, code) {
        return "<span style='color:blue;cursor:pointer' onclick='" + code + "'>"
            + text + "</span>";
    }
    /**
     * Run the tests from TestClass.
     * If parameter testNames is supplied only the tests with the names
     * supplied in that array will be executed.
     *
     * @param {!function(new:core.UnitTest,core.UnitTestRunner)} TestClass
     *              The constructor for the test class.
     * @param {!function():undefined} callback
     * @param {!Array.<!string>} testNames
     * @return {undefined}
     */
    this.runTests = function (TestClass, callback, testNames) {
        var testName = Runtime.getFunctionName(TestClass) || "",
            /**@type{!string}*/
            tname,
            runner = new core.UnitTestRunner(),
            test = new TestClass(runner),
            testResults = {},
            i,
            /**@type{function()|function(function())}*/
            t,
            tests,
            lastFailCount,
            inBrowser = runtime.type() === "BrowserRuntime";

        // check that this test has not been run or started yet
        if (results.hasOwnProperty(testName)) {
            runtime.log("Test " + testName + " has already run.");
            return;
        }

        if (inBrowser) {
            runtime.log("<span>Running "
                + link(testName, "runSuite(\"" + testName + "\");")
                + ": " + test.description() + "</span>");
        } else {
            runtime.log("Running " + testName + ": " + test.description);
        }
        tests = test.tests();
        for (i = 0; i < tests.length; i += 1) {
            t = tests[i].f;
            tname = tests[i].name;
            if (testNames.length && testNames.indexOf(tname) === -1) {
                continue;
            }
            if (inBrowser) {
                runtime.log("<span>Running "
                    + link(tname, "runTest(\"" + testName + "\",\""
                                  + tname + "\")") + "</span>");
            } else {
                runtime.log("Running " + tname);
            }
            lastFailCount = runner.countFailedTests();
            test.setUp();
            t();
            test.tearDown();
            testResults[tname] = lastFailCount === runner.countFailedTests();
        }
        /**
         * @param {!Array.<!core.NamedAsyncFunction>} todo
         * @return {undefined}
         */
        function runAsyncTests(todo) {
            if (todo.length === 0) {
                results[testName] = testResults;
                failedTests += runner.countFailedTests();
                callback();
                return;
            }
            t = todo[0].f;
            var fname = todo[0].name;
            runtime.log("Running " + fname);
            tname = t.name;
            if (testNames.length && testNames.indexOf(tname) === -1) {
                return runAsyncTests(todo.slice(1));
            }
            if (inBrowser) {
                runtime.log("<span>Running "
                    + link(fname, "runTest(\"" + testName + "\",\""
                                  + fname + "\")") + "</span>");
            } else {
                runtime.log("Running " + fname);
            }
            lastFailCount = runner.countFailedTests();
            test.setUp();
            t(function () {
                test.tearDown();
                testResults[fname] = lastFailCount ===
                    runner.countFailedTests();
                runAsyncTests(todo.slice(1));
            });
        }
        runAsyncTests(test.asyncTests());
    };
    /**
     * @return {!number}
     **/
    this.countFailedTests = function () {
        return failedTests;
    };
    /**
     * @return {!Object}
     **/
    this.results = function () {
        return results;
    };
};
