type Prefix<Prefix extends string, T> = { [P in keyof T & string as `${Prefix}${Capitalize<P>}`]: T[P] };

type Handle<PoolId extends string> = number & {__discriminator__:`Handle for ${PoolId}`}
type Struct<Field extends string, Value extends number | (number & {__discriminator__:string})> = Record<Field, Value>;

type PoolClass<PoolId extends string, S extends Struct<Field, Value>, Field extends string, Value extends number | (number & {__discriminator__:string})> = {
    allocate(): Handle<PoolId>; // zero initialized new object
    free(id:Handle<PoolId>):void;
    validate(id:Handle<PoolId>):boolean;
    // readonly lenght: number; // currently alive objects
    // readonly capacity: number; // maximal alive objects (js operates implicitly with int32 so the maximal possible capacity is 2^32)
    // readonly maxCreations: number; // maximum times a new object can be created 2^(32 - log(capacity)) * capacity
    // readonly verionBits: number // bits that are used to version object slots (32 - log(capacity))
    }
    
    & Prefix<"get",{ [key in keyof S]: ((id:Handle<PoolId>) => S[key]) }>
    & Prefix<"set",{ [key in keyof S]: ((id:Handle<PoolId>, value:S[key]) => void) }>

export const FieldType = {
    Uint8: 0 ,
    Int8: 1,
    Uint16: 2,
    Int16: 3 ,
    Uint32: 4,
    Int32: 5 
} as const
type FieldTypeName = keyof typeof FieldType
type FieldType = typeof FieldType[FieldTypeName];


function sizeInBytes(t: FieldType):number{
    return Math.round((t / 2) + 0.5);
}

function fieldTypeName(t:FieldType):FieldTypeName{
for(const [key, value] of Object.entries(FieldType)){
    if(value === t) return key as FieldTypeName;
    }
    throw Error(`Invalid field type '${t}'`);
}

function calculateSlotSizeInBytes(structTypeArray: ReadonlyArray<FieldType>, bytesToStoreObjectHandle:number){
    let result = bytesToStoreObjectHandle;
    for(const t of structTypeArray){
        result += sizeInBytes(t);
    }
    return result;
}


export function newPool<PoolId extends string, S extends Struct<Field, Value>, Field extends string, Value extends number | (number & { __discriminator__: string; })>(id: PoolId, struct: S, capacity: number): PoolClass<PoolId, S, Field, Value> {
    const structTypeArray = [...Object.values(struct)] as ReadonlyArray<FieldType>;
    const bytesToStoreObjectIndex = 2;
    const bytesToStoreObjectVersion = 2;
    const bytesToStoreObjectHandle = bytesToStoreObjectIndex + bytesToStoreObjectVersion;
    const objectVersionOffset = 0;
    const slotSizeInBytes = calculateSlotSizeInBytes(structTypeArray, bytesToStoreObjectHandle);
    const poolBuffer = new ArrayBuffer(slotSizeInBytes * capacity);
    const poolView = new DataView(poolBuffer, 0, poolBuffer.byteLength);

    const freeSlotsBuffer = new ArrayBuffer((capacity + 1) * bytesToStoreObjectHandle);
    const freeSlots = new Uint32Array(freeSlotsBuffer, 0, capacity +1).map((_, i) => i);
    let freeSlotsHead = capacity - 1;
    let freeSlotsTail = 0;

    let deactavatedSlots = 0;

    function queueFreeSlot(id: Handle<PoolId>) {
        freeSlots[freeSlotsHead] = id;
        freeSlotsHead = (freeSlotsHead + 1) % capacity;
    }
    function dequeueFreeSlot(): Handle<PoolId> | undefined {
        if (freeSlotsHead === freeSlotsTail) return;
        const result = freeSlots[freeSlotsTail];
        freeSlotsTail = (freeSlotsTail + 1) % capacity;
        return result as Handle<PoolId>;
    }



    function getStoredHandle(id: Handle<PoolId>) {
        return poolView.getInt32(byteOffset(id) + objectVersionOffset);
    }


    function getField(propertyByteOffset: number, fieldTypeName: FieldTypeName) {
        const getFn = poolView[`get${fieldTypeName}`].bind(poolView);
        return (handle: Handle<PoolId>) => {
            return getFn(byteOffset(handle) + propertyByteOffset);
        };
    }

    function setField(propertyByteOffset: number, fieldTypeName: FieldTypeName) {
        const setFn = poolView[`set${fieldTypeName}`].bind(poolView);
        return (handle: Handle<PoolId>, n: number) => {
            setFn(byteOffset(handle) + propertyByteOffset, n);
        };
    }

    const indexMask = Math.pow(2, bytesToStoreObjectIndex * 8);
    const versionMask = Math.pow(2, bytesToStoreObjectVersion * 8) << bytesToStoreObjectIndex * 8;

    function byteOffset(id: Handle<PoolId>): number {
        return (id & indexMask) * slotSizeInBytes;
    }

    function version(id: Handle<PoolId>) {
        return (id & versionMask);
    }

    function initializeZero(id: Handle<PoolId>) {
        const offset = byteOffset(id);
        // important: skip the bytes that store the object version
        for (let i = bytesToStoreObjectHandle; i < slotSizeInBytes; i += 1) {
            poolView.setUint8(offset + i, 0);
        }
    }

    function increaseVersion(id: Handle<PoolId>): Handle<PoolId> {
        const index = id & indexMask;
        const vPlus = ((version(id) >> bytesToStoreObjectIndex) + 1) << bytesToStoreObjectIndex;
        return (index | vPlus) as Handle<PoolId>;
    }

    // -------------------------------------------------------------------------------------------------------------
    // --------------------  PUBLIC  -------------------------------------------------------------------------------
    // -------------------------------------------------------------------------------------------------------------

    function allocate(): Handle<PoolId> {
        const result = dequeueFreeSlot();
        if (result !== undefined) return result;
        throw Error("Out of Slots");
    }

    function free(id: Handle<PoolId>) {
        initializeZero(id);
        const newHandle = increaseVersion(id);
        // check weather all versions are used. Deactivate slot if no version is free
        if (version(newHandle) !== 0) {
            queueFreeSlot(newHandle);
        } else {
            deactavatedSlots += 1;
            if (deactavatedSlots >= capacity) {
                throw Error("Out of creations");
            }
        }
    }

    function validate(id: Handle<PoolId>) {
        const index = id & indexMask;
        return 0 < index && index <= capacity // validate range
            && getStoredHandle(id) === id; // validate object version
    }


    const result: any = {
        allocate,
        free,
        validate,
    };

    let fieldOffset = bytesToStoreObjectHandle;
    const keysAndTypes = [...Object.entries(struct)] as unknown as ReadonlyArray<[Field, FieldType]>;
    for (const [key, value] of keysAndTypes) {
        const capitalizedKey = key[0].toUpperCase() + key.slice(1);
        result[`get${capitalizedKey}`] = getField(fieldOffset, fieldTypeName(value));
        result[`set${capitalizedKey}`] = setField(fieldOffset, fieldTypeName(value));
        fieldOffset += sizeInBytes(value);
    }

    return result as PoolClass<PoolId, S, Field, Value>;
}
