import React, { useState } from "react"
import EmailStep from "./step1"
import PasswordStep from "./step2"

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

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)

    setTimeout(() => {
      setIsLoading(false)
    }, 3000)
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