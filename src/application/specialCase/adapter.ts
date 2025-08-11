type Reason = 'lack_of_time' | 'sickness' | 'injury' | 'other';

export const adapterUserInfo = (data: any) => {
  const result = {
    reason: data?.reason as Reason,
    description: data?.description ?? null,
    current_user_date: data?.current_user_date ?? new Date().toISOString().split('T')[0],
    current_user_time: data?.current_user_time ?? new Date().toISOString().split('T')[1].split('.')[0],
  };

  return result;
};
