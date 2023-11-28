"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newPool = exports.FieldType = void 0;
exports.FieldType = {
    Uint8: 0,
    Int8: 1,
    Uint16: 2,
    Int16: 3,
    Uint32: 4,
    Int32: 5
};
function sizeInBytes(t) {
    return Math.round((t / 2) + 0.5);
}
function fieldTypeName(t) {
    for (const [key, value] of Object.entries(exports.FieldType)) {
        if (value === t)
            return key;
    }
    throw Error(`Invalid field type '${t}'`);
}
function newPool(id, struct, capacity) {
    const structTypeArray = [...Object.values(struct)];
    const bytesToStoreObjectIndex = 2;
    const bytesToStoreObjectVersion = 2;
    const bytesToStoreObjectHandle = bytesToStoreObjectIndex + bytesToStoreObjectVersion;
    const objectVersionOffset = 0;
    /** @ts-ignore */
    const fieldSizeInBytes = structTypeArray.reduce((a, b) => a + sizeInBytes(b), 0) + bytesToStoreObjectHandle;
    const poolBuffer = new ArrayBuffer(fieldSizeInBytes * capacity);
    const poolView = new DataView(poolBuffer, 0, poolBuffer.byteLength);
    const freeSlotsBuffer = new ArrayBuffer((capacity + 1) * bytesToStoreObjectHandle);
    const freeSlots = new Uint32Array(freeSlotsBuffer, 0, capacity + 1).map((_, i) => i);
    let freeSlotsHead = capacity;
    let freeSlotsTail = 0;
    let deactavatedSlots = 0;
    function queueFreeSlot(id) {
        freeSlots[freeSlotsHead] = id;
        freeSlotsHead = (freeSlotsHead + 1) % capacity;
    }
    function dequeueFreeSlot() {
        if (freeSlotsHead === freeSlotsTail)
            return;
        const result = freeSlots[freeSlotsTail];
        freeSlotsTail = (freeSlotsTail + 1) % capacity;
        return result;
    }
    function getStoredHandle(id) {
        return poolView.getInt32(byteOffset(id) + objectVersionOffset);
    }
    function getField(propertyByteOffset, fieldTypeName) {
        const getFn = poolView[`get${fieldTypeName}`];
        return (handle) => {
            return getFn(byteOffset(handle) + propertyByteOffset);
        };
    }
    function setField(propertyByteOffset, fieldTypeName) {
        const setFn = poolView[`set${fieldTypeName}`];
        return (handle, n) => {
            setFn(byteOffset(handle) + propertyByteOffset, n);
        };
    }
    function validateHandle(id) {
        const index = id & indexMask;
        return 0 < index && index <= capacity // validate range
            && getStoredHandle(id) === id; // validate object version
    }
    const indexMask = Math.pow(2, bytesToStoreObjectIndex * 8);
    const versionMask = Math.pow(2, bytesToStoreObjectVersion * 8) << bytesToStoreObjectIndex * 8;
    function byteOffset(id) {
        return (id & indexMask) * fieldSizeInBytes;
    }
    function version(id) {
        return (id & versionMask);
    }
    function initializeZero(id) {
        const offset = byteOffset(id);
        // important: skip the bytes that store the object version
        for (let i = bytesToStoreObjectHandle; i < fieldSizeInBytes; i += 1) {
            poolView.setUint8(offset + i, 0);
        }
    }
    function increaseVersion(id) {
        const index = id & indexMask;
        const vPlus = ((version(id) >> bytesToStoreObjectIndex) + 1) << bytesToStoreObjectIndex;
        return (index | vPlus);
    }
    function allocateSlot() {
        const result = dequeueFreeSlot();
        if (result)
            return result;
        throw Error("Out of Slots");
    }
    function freeSlot(id) {
        initializeZero(id);
        const newHandle = increaseVersion(id);
        // check weather all versions are used. Deactivate slot if no version is free
        if (version(newHandle) !== 0) {
            queueFreeSlot(newHandle);
        }
        else {
            deactavatedSlots += 1;
            if (deactavatedSlots >= capacity) {
                throw Error("Out of creations");
            }
        }
    }
    const result = {
        allocate: allocateSlot,
        free: freeSlot,
        validate: validateHandle,
    };
    let fieldOffset = bytesToStoreObjectHandle;
    const keysAndTypes = [...Object.entries(struct)];
    for (const [key, value] of keysAndTypes) {
        const capitalizedKey = key[0].toUpperCase() + key.slice(1);
        result[`get${capitalizedKey}`] = getField(fieldOffset, fieldTypeName(value));
        result[`set${capitalizedKey}`] = setField(fieldOffset, fieldTypeName(value));
        fieldOffset += sizeInBytes(value);
    }
    return result;
}
exports.newPool = newPool;
