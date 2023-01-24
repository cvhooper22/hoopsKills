export function makeSortAscByKey (key) {
    return (objA, objB) => {
        if (objA[key] > objB[key]) {
            return 1;
        }
        if (objA[key] < objB[key]) {
            return -1;
        }
        return 0;
    };
}

export function makeSortDescByKey (key) {
    return (objA, objB) => {
        if (objA[key] < objB[key]) {
            return 1;
        }
        if (objA[key] > objB[key]) {
            return -1;
        }
        return 0;
    };
}