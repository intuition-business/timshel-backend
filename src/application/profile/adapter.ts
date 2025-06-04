export const adapterForms = (data: any) => {
  const result = data.map((item: any) => {
    return {
      user_id: item?.usuario_id,
      image: item?.imagen,

    };
  });
  return result;
};
