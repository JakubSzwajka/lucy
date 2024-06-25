import React, { useState } from "react"
import EmailStep from "./step1"
import PasswordStep from "./step2"
import { api } from "@/api";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}


export default function RegisterPage({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => {
    if (step === 1) return;
    setStep(step - 1)
  };

  const [register] = api.useRegisterMutation()

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    
    setIsLoading(true)
    register({ email, password }).then(() => {
      setIsLoading(false)
    }).catch((error) => {
      console.error(error)
      setIsLoading(false)
    })
  }


  return (
    <div>
      {step === 1 && (
        <EmailStep email={email} setEmail={setEmail} onNext={handleNext} isLoading={isLoading}/>
      )}
      {step === 2 && (
        <PasswordStep password={password} setPassword={setPassword} onPrev={handlePrev} onNext={onSubmit} isLoading={isLoading}/>
      )}
    </div>
  )
}