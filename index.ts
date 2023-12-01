import {newPool, FieldType} from "./newPool";




function PT(value:number){
return value as Lenght;
}
type Lenght = number & {__discriminator__: "Lenght in pt"}


function sum(...ls: Lenght[]){
    return ls.reduce((a, b) => a + b, 0) as Lenght;
}

const RectStruct = {
    width:FieldType.Int16 as Lenght,
    height:FieldType.Int16 as Lenght,

    leftX:FieldType.Int32 as number,
    topY:FieldType.Int32 as number,

    colorR: FieldType.Int8 as number,
    colorG: FieldType.Int8 as number,
    colorB: FieldType.Int8 as number,
} as const;

const p = newPool("Rectangle", RectStruct, 3);
const r0 = p.allocate()

p.setWidth(r0,PT(8)),
p.setHeight(r0, PT(8)),
p.setLeftX(r0, 1)
p.setTopY(r0, 2)
p.setColorR(r0, 18)
p.setColorG(r0, -2)
p.setColorB(r0, 0)

p.setHeight(r0, PT(8));

const r0Width:Lenght = p.getWidth(r0);
console.log("getWidth", r0Width);
console.log("getHeight", p.getHeight(r0));
console.log("getLeftX", p.getLeftX(r0));
console.log("getTopY", p.getTopY(r0));
console.log("getColorR", p.getColorR(r0));
console.log("getColorG", p.getColorG(r0));
console.log("getColorB", p.getColorB(r0));
