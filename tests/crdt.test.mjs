import * as Y from "yjs";
import assert from "assert";

console.log("=== Running CRDT Simultaneous Concurrent Edit Test ===");

const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

const text1 = doc1.getText("tiptap");
const text2 = doc2.getText("tiptap");

text1.insert(0, "Hello World");

const update1 = Y.encodeStateAsUpdate(doc1);
Y.applyUpdate(doc2, update1);

assert.strictEqual(text2.toString(), "Hello World", "Doc2 should match Doc1 initial state");
console.log(" Initial state synchronized: 'Hello World'");

text1.insert(6, "Beautiful ");

text2.insert(11, " from Team!");

const updateFromClient1 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
const updateFromClient2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));

Y.applyUpdate(doc2, updateFromClient1);
Y.applyUpdate(doc1, updateFromClient2);

assert.strictEqual(
  text1.toString(),
  text2.toString(),
  "Both documents must mathematically converge to identical state without conflict"
);

console.log(" Both clients converged to identical state:");
console.log(`  Client 1: "${text1.toString()}"`);
console.log(`  Client 2: "${text2.toString()}"`);
console.log(" CRDT Verification Test Passed Successfully!");
