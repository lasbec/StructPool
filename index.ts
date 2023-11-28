
type Prefix<Prefix extends string, T> = { [P in keyof T & string as `${Prefix}${Capitalize<P>}`]: T[P] };

type PoolClass<PoolId extends string, S extends Struct<Field, Value>, Field extends string, Value extends number | (number & {__discriminator__:string})> = {
    create(initalValues: S): Handler<PoolId>;
    init(): Handler<PoolId>; // zero initialized new object
    isAlive(id:Handler<PoolId>):boolean;
    free(id:Handler<PoolId>):void;
    readonly lenght: number; // currently alive objects
    readonly capacity: number; // maximal alive objects (js operates implicitly with int32 so the maximal possible capacity is 2^32)
    readonly maxCreations: number; // maximum times a new object can be created 2^(32 - log(capacity)) * capacity
    readonly verionBits: number // bits that are used to version object slots (32 - log(capacity))
    }
    
    & Prefix<"get",{ [key in keyof S]: ((id:Handler<PoolId>) => S[key]) }>
    & Prefix<"set",{ [key in keyof S]: ((id:Handler<PoolId>, value:S[key]) => void) }>

const FieldType = {
    UInt8: 0 ,
    Int8: 1,
    UInt16: 2,
    Int16: 3 ,
    UInt32: 4,
    Int32: 5 
} as const
type FieldType = typeof FieldType[keyof typeof FieldType];


function sizeInBytes(t: FieldType):number{
    return Math.round((t / 2) + 0.5);
}


type Struct<Field extends string, Value extends number | (number & {__discriminator__:string})> = Record<Field, Value>;


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


type Handler<PoolId extends string> = number & {__discriminator__: `Handler for ${PoolId}`};

function newPool<PoolId extends string,S extends Struct<Field, Value>, Field extends string, Value extends number | (number & {__discriminator__:string})>(id:PoolId, struct: S, capacity: number): PoolClass<PoolId, S, Field, Value> {
    const structTypeArray = [...Object.values(struct)] as ReadonlyArray<FieldType>;
    const fieldSizeInBytes = structTypeArray.reduce((a:number, b: FieldType):number => a + sizeInBytes(b), 0);
    const poolBuffer = new ArrayBuffer(fieldSizeInBytes * capacity)
    const poolView = new DataView(poolBuffer);
    let poolHeadIndex = 0;


    function clouserGettingForProperty(propertyByteOffset:number, getterName: "getUint16"){
        const getFn = poolView[getterName];
        return (handle:Handler<PoolId>)=>{
            return getFn(handle * fieldSizeInBytes + propertyByteOffset);
        }
    }

    return {
        init(){
            poolHeadIndex += 1;
            return poolHeadIndex - 1 as Handler<PoolId>;
        }
    }
}

const p = newPool("Rectangle", RectStruct, 3);

const r0 = p.create({
    width: PT(8),
    height: PT(8),

    leftX: 1,
    topY: 2,

    colorR: 0,
    colorG: 0,
    colorB: 0
})

p.getLeftX(r0);

p.setHeight(r0, PT(8));



function createStructPool<ID extends string,Fields extends string, Brand extends Record<Fields, B>, B extends { __discriminator__ :string } | number>(name:ID, fields:Record<Fields, FieldType>, poolLength:number, fieldBranding: Partial<Record<Fields, Brand>>): PoolClass<ID, Fields, Brand, B> {
    const filedSizeInBytes = 4;
    const poolSizeInBytes = poolLength * fields.length * filedSizeInBytes;
    const poolBuffer = new ArrayBuffer(poolSizeInBytes);
    const pool = new DataView(poolBuffer, poolBuffer.byteLength, poolBuffer.byteLength);
    let poolHead  = 0;

    function createGetterForKeyIndex(keyIndex:number) {
        return (objId:number & {__discriminator__: ID} ):number => {
            return pool[objId + keyIndex];
        }
    }
    function createSetterForKeyIndex(keyIndex:number) {
        return (objId:number & {__discriminator__: ID},value:number ) => {
            pool[objId + keyIndex] = value;
        }
    }
    function fill(objId:number & {__discriminator__: ID},values: Record<Fields, number> ){
            let keyIndex = -1;
            for(const key of fields){
                keyIndex +=1;
                const value = values[key];
                pool[objId + keyIndex] = value;
            }
    }


    const result:any = {
        name,
        size: poolSizeInBytes,
        get length() {
            return poolHead;
        },
        fill,
        create:(initalValues: Record<Fields, number>): number & {__discriminator__: ID} =>{
            fill(poolHead as number & {__discriminator__: ID}, initalValues);
            poolHead += fields.length as number & {__discriminator__: ID};
            return poolHead - fields.length as number & {__discriminator__: ID} 
        }
    };


    let keyIndex = -1;
    for(const key of fields){
        const upperCaseKey = key[0].toUpperCase() + key.slice(1);
        keyIndex +=1;
        result[`get${upperCaseKey}`] = createGetterForKeyIndex(keyIndex);
        result[`set${upperCaseKey}`] = createSetterForKeyIndex(keyIndex);
    }

    return result;
}