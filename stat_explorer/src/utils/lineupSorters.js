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

export function makeAvgAscSort(key, total) {
    return (objA, objB) => {
        const avgA = objA[key] / total;
        const avgB = objB[key] / total;
        if (avgA > avgB) {
            return 1;
        }
        if (avgA < avgB) {
            return -1;
        }
        return 0;
    }
}

export function makeAvgDescSort(key, total) {
    return (objA, objB) => {
        const avgA = objA[key] / total;
        const avgB = objB[key] / total;
        if (avgA < avgB) {
            return 1;
        }
        if (avgA > avgB) {
            return -1;
        }
        return 0;
    }
}