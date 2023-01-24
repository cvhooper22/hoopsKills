export function condenseStints (lineupData) {
    const lineupStints = lineupData.reduce((stints, l) => {
        return [...stints, ...l.stints];
    }, []);
    const sortedStints = lineupStints.sort((sA, sB) => sA.gameIndex - sB.gameIndex);
    const condensedStints = sortedStints.reduce((agg, stint) => {
        if (agg.length === 0) {
            agg.push(stint);
            return agg;
        }
        const prevIndex = agg.findIndex(s => (s.end === stint.start && !s.isEndPeriod));
        const newAgg = [...agg];
        if (prevIndex < 0) {
            newAgg.push(stint);
            return newAgg;
        }
        const prevStint = newAgg[prevIndex];
        const newStint = {
            ...prevStint,
            end: stint.end,
            net: prevStint.net + stint.net,
        };
        if (stint.isEndPeriod) {
            newStint.isEndPeriod = stint.isEndPeriod;
        }
        newAgg[prevIndex] = newStint;
        return newAgg;
    }, []);
    return condensedStints;
}

export function namesToReadable(names) {
    const readableNames = names.map(p => {
        const first = p.split(',')[1];
        let lastUpper = p.split(',')[0];
        let lastlower = lastUpper.toLowerCase();
        let last = `${lastUpper[0]}${lastlower.slice(1)}`
        const lastNameParts = lastUpper.split(' ');
        if (lastNameParts.length > 1) {
            // name has a space in it
            const parts = lastNameParts.map(part => `${part[0]}${part.toLowerCase().slice(1)}`);
            last = parts.join(' ');
        }
        return `${first[0]}. ${last}`;
    });
    return readableNames;
}

export function getStintsLabel(playerArr, altLabel) {
    let label = ''
    const labelForCount = {
        2: 'both players',
        3: 'all three players',
        4: 'all four players',
    };
    if (playerArr.length < 1) {
        return label;
    }
    let playerString = '';
    if (playerArr.length > 1) {
        playerString = labelForCount[playerArr.length];
    } else {
        // length is 1
        const readable = namesToReadable(playerArr);
        playerString = readable[0];
    }
    return `${altLabel ?? 'Stints'} with ${playerString} on the court`;
}