const IAM_USERS_UPDATED_EVENT = 'sva:iam-users-updated';

export const notifyIamUsersUpdated = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(IAM_USERS_UPDATED_EVENT));
};

export const subscribeIamUsersUpdated = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleEvent = () => {
    listener();
  };

  window.addEventListener(IAM_USERS_UPDATED_EVENT, handleEvent);
  return () => {
    window.removeEventListener(IAM_USERS_UPDATED_EVENT, handleEvent);
  };
};
