export const adapterWeights = (data: any) => {
    const result = data.map((item: any) => {
        return {
            weight: item?.weight,
            date: item?.date,
        };
    });
    return result;
};