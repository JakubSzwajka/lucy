import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/ui/icons"
import React from "react"

interface EmailStepProps extends React.HTMLAttributes<HTMLDivElement> {
    email: string;
    setEmail: (email: string) => void;
    onNext: () => void;
    isLoading: boolean;
    
}

export const  EmailStep = ({email, setEmail, onNext, className, isLoading, ...props} : EmailStepProps) => {
    return (
        <>          
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create an account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email below to create your account
          </p>
        </div>
        <div className={cn("grid gap-6", className)} {...props}>
          <form onSubmit={onNext}>
            <div className="grid gap-2">
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                />
              </div>
              <Button
                disabled={isLoading}
              >
              {isLoading && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}

                That's my email! Let's set a password!
              </Button>
            </div>
          </form>
        </div> 
      </div>
    </>
    
    )
}

export default EmailStep