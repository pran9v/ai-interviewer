import { createContext } from "react";

interface UserDetail {
    _id?: string;
    email?: string;
    imageUrl?: string;
    name?: string;
}

interface UserDetailContextType {
    userDetail: UserDetail | null;
    setUserDetail: (userDetail: UserDetail | null) => void;
}

export const UserDetailContext = createContext<UserDetailContextType>({
    userDetail: null,
    setUserDetail: () => {},
});