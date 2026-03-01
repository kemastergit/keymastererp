import { useState } from 'react'

export default function TecladoPin({ onComplete, length = 4 }) {
    const [pin, setPin] = useState('')

    const handlePress = (num) => {
        if (pin.length < length) {
            const newPin = pin + num
            setPin(newPin)
            if (newPin.length === length) {
                onComplete(newPin)
                setTimeout(() => setPin(''), 500)
            }
        }
    }

    const handleDelete = () => setPin(pin.slice(0, -1))

    return (
        <div className="flex flex-col items-center gap-10">
            {/* PIN Dots (Centered and Premium) */}
            <div className="flex justify-center gap-6">
                {[...Array(length)].map((_, i) => (
                    <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all duration-300
            ${pin.length > i
                            ? 'bg-primary border-primary scale-125 shadow-[0_0_15px_rgba(11,114,133,0.4)]'
                            : 'border-slate-200 bg-slate-50'}`}>
                    </div>
                ))}
            </div>

            {/* Grid Teclado (Fixed width for centering) */}
            <div className="grid grid-cols-3 gap-6 max-w-[280px] w-full mx-auto justify-items-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} onClick={() => handlePress(num.toString())}
                        className="w-16 h-16 bg-white border-2 border-slate-100 text-2xl font-black text-slate-700 
            hover:border-primary hover:text-primary active:bg-primary active:text-white active:scale-90 transition-all shadow-sm flex items-center justify-center cursor-pointer rounded-2xl group">
                        <span className="group-active:scale-125 transition-transform">{num}</span>
                    </button>
                ))}
                <button onClick={handleDelete}
                    className="w-16 h-16 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-500 active:text-white active:scale-90 transition-all flex items-center justify-center cursor-pointer rounded-2xl">
                    <span className="material-icons-round">backspace</span>
                </button>
                <button onClick={() => handlePress('0')}
                    className="w-16 h-16 bg-white border-2 border-slate-100 text-2xl font-black text-slate-700 
            hover:border-primary hover:text-primary active:bg-primary active:text-white active:scale-90 transition-all shadow-sm flex items-center justify-center cursor-pointer rounded-2xl group">
                    <span className="group-active:scale-125 transition-transform">0</span>
                </button>
                <div className="w-16 h-16 flex items-center justify-center">
                    <span className="material-icons-round text-primary opacity-30 animate-pulse text-3xl">fingerprint</span>
                </div>
            </div>
        </div>
    )
}
