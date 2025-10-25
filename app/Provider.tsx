"use client"
import { UserDetailContext } from '@/context/UserDetailContext';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner';

function Provider({ children }: any) {
    const { user, isLoaded } = useUser();
    const CreateUser = useMutation(api.users.CreateNewUser);
    const [userDetail, setUserDetail] = useState<any>();

    useEffect(() => {
        if (isLoaded && user) {
            CreateNewUser().catch((error) => {
                console.error('Error creating user:', error);
                toast.error('Error initializing user profile');
            });
        }
    }, [isLoaded, user])

    const CreateNewUser = async () => {
        try {
            if (user) {
                const result = await CreateUser({
                    email: user.primaryEmailAddress?.emailAddress ?? '',
                    imageUrl: user.imageUrl,
                    name: user.fullName ?? ''
                });
                setUserDetail(result);
            }
        } catch (error) {
            console.error('Error in CreateNewUser:', error);
            throw error;
        }
    }

    if (!isLoaded) {
        return <div>{children}</div>;
    }

    return (
        <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
            <div>{children}</div>
        </UserDetailContext.Provider>
    )
}

export default Provider