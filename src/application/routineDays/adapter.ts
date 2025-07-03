export const adapterRoutineDays = (data: any) => {
  const result = data.map((item: any) => {
    return {
      day: item?.day,
      date: item?.date,
    };
  });
  return result;
};