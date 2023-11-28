"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const newPool_1 = require("./newPool");
function PT(value) {
    return value;
}
function sum(...ls) {
    return ls.reduce((a, b) => a + b, 0);
}
const RectStruct = {
    width: newPool_1.FieldType.Int16,
    height: newPool_1.FieldType.Int16,
    leftX: newPool_1.FieldType.Int32,
    topY: newPool_1.FieldType.Int32,
    colorR: newPool_1.FieldType.Int8,
    colorG: newPool_1.FieldType.Int8,
    colorB: newPool_1.FieldType.Int8,
};
const p = (0, newPool_1.newPool)("Rectangle", RectStruct, 3);
const r0 = p.allocate();
p.setWidth(r0, PT(8)),
    p.setHeight(r0, PT(8)),
    p.setLeftX(r0, 1);
p.setTopY(r0, 2);
p.setColorR(r0, 18);
p.setColorG(r0, -2);
p.setColorB(r0, 0);
p.setHeight(r0, PT(8));
console.log("getWidth", p.getWidth(r0));
console.log("getHeight", p.getHeight(r0));
console.log("getLeftX", p.getLeftX(r0));
console.log("getTopY", p.getTopY(r0));
console.log("getColorR", p.getColorR(r0));
console.log("getColorG", p.getColorG(r0));
console.log("getColorB", p.getColorB(r0));
