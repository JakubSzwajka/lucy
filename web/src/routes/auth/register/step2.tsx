import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/ui/icons"
import React from "react"
import { ArrowLeft } from "lucide-react"

interface PasswordStepProps extends React.HTMLAttributes<HTMLDivElement> {
    password: string;
    setPassword: (password: string) => void;
    onPrev: () => void;
    onNext: (event: React.SyntheticEvent) => void;
    isLoading: boolean;
}

export const PasswordStep = ({password, setPassword, className, onPrev, onNext, isLoading, ...props} : PasswordStepProps)  => {
    

    return (
        <>
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create an account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your password below to finish!
          </p>
        </div>
        <div className={cn("grid gap-6", className)} {...props}>
          <form onSubmit={onNext}>
            <div className="grid gap-2">
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor="password">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor="password">
                  Password
                </Label>
                <Input
                  id="password-confirm"
                  type="password"
                  placeholder="confirm password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isLoading}
                />
              </div>
              <div className="flex space-x-2">
                <Button className="flex-shrink-0" onClick={onPrev} disabled={isLoading}>
                    <ArrowLeft/>
                </Button>
                <Button className="flex-grow" disabled={isLoading}>
                  {isLoading && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Account! 🚀
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
    
    )
}

export default PasswordStep