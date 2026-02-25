export const adapterPlans = (data: any) => {
    const result = data.map((item: any) => {
        return {
            id: item?.id,
            title: item?.title,
            price_cop: item?.price_cop,
            description_items: item?.description_items,
            description: item?.description,
            activo: item?.activo === 1 ? true : false
        };
    });
    return result;
};