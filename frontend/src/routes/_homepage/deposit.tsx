import {createFileRoute, useNavigate} from "@tanstack/react-router";
import api from "@/lib/api";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {useAuth} from "@/components/AuthProvider";
import {useState} from "react";
import {useToast} from "@/hooks/use-toast.ts";

export const Route = createFileRoute("/_homepage/deposit")({
  component: Deposit,
});

export default function Deposit() {
  const [deposit, setDeposit] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { reload: reloadUserInfo } = useAuth();

  const submit = async () => {
    try {
      const response = await api.get(`/api/deposit?deposit=${deposit}`);

      if (response.status === 200) {
        await navigate({to: '/'});
        reloadUserInfo();
      }
    } catch {
      toast({
        type: "foreground",
        title: "Coś poszło nie tak",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-[80vh] flex md:items-center justify-center mt-5 md:mt-6 mb-3">
      <Card className='md:p-5 bg-none flex flex-col items-center border-none md:bg-gray-900 md:shadow-xl text-white'>
        <p className='text-xl'>Wykonaj depozyt</p>
        <div className='flex gap-4 mt-3'>
          <Button onClick={() => setDeposit(5)}>5</Button>
          <Button onClick={() => setDeposit(10)}>10</Button>
          <Button onClick={() => setDeposit(20)}>20</Button>
          <Button onClick={() => setDeposit(50)}>50</Button>
          <Button onClick={() => setDeposit(100)}>100</Button>
          <Button onClick={() => setDeposit(200)}>200</Button>
          <Button onClick={() => setDeposit(1000)}>1000</Button>
        </div>

        <div className='mt-3'>
          <p>Własna kwota:</p>
          <Input type={"number"} className='w-28' onChange={(e) => setDeposit(e.target.value) }/>
        </div>

        <Button className='m-3' onClick={() => submit()}>Depozyt: {deposit} PLN</Button>


      </Card>
    </div>
  );
}
