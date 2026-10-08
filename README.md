# Lift Lab by Dwon

Online coaching website: free BMI / calorie / macro calculator, and a ₹499/month diet + workout plan that opens with an unlock code.

## Files

| File | Kya hai |
|---|---|
| `index.html` | Main website |
| `coach.html` | Coach desk (sirf Dwon ke liye): unlock code banana aur check karna |
| `js/config.js` | **Settings**: WhatsApp number, UPI ID, price, coach PIN |
| `js/engine.js` | Saare formulas: BMI, calories, macros, diet plan, workout plan, codes |
| `js/app.js` | Website ke buttons aur form |
| `css/style.css` | Design |
| `assets/upi-qr.png` | UPI QR code |
| `assets/logo.webp` | Poora logo, bina background (Thank you letter ke upar) |
| `assets/logo-mark.webp` | Sirf hexagon emblem (menu aur footer mein) |
| `assets/favicon.png`, `assets/apple-touch-icon.png` | Browser tab aur phone home-screen ka icon |

Logo badalna ho to nayi image inhi naamon se `assets` mein daal do.

## Settings badalna

`js/config.js` kholo, value badlo, save karo, page refresh karo.

- `price`: plan ki fees
- `whatsapp`: number, country code ke saath (91...)
- `upiId`, `payeeName`: QR ke neeche dikhne wali details
- `validDays`: naya code kitne din chalega (default 30)
- `secret`: isse codes bante hain. **Isse badloge to purane saare codes band ho jayenge.**

QR badalna ho to nayi image `assets/upi-qr.png` naam se daal do.

**Upload se pehle zaroori:** `index.html` aur `coach.html` mein CSS/JS ke link ke aage `?v=20261008b` jaisa version likha hai. Koi bhi CSS ya JS file badlo to ye version badal do (jaise `?v=20261009a`). Warna logon ke phone purani cached file chalate rahenge.

## Client ka plan kaise unlock hota hai

1. Client website par apni details bharta hai aur ₹499 UPI se pay karta hai.
2. Wo WhatsApp par screenshot bhejta hai.
3. Aap `coach.html` kholte ho, PIN daalte ho, client ka naam/number daal ke **Make code** dabate ho.
4. **Send on WhatsApp** se code client ko chala jata hai. Client code daalta hai aur plan khul jata hai.
5. Code 30 din baad apne aap band ho jata hai. Agle mahine payment ke baad naya code bhejo.

PIN badalne ke liye coach desk mein **Change PIN** use karo.

Dhyan rahe: ye lock bina server ke hai. Koi coding jaanne wala banda code ka tareeka nikaal sakta hai. Aam clients ke liye ye kaafi hai.

## Formulas (taaki aap clients ko bata sako)

- **BMI**: weight (kg) ÷ height (m)². Indian/Asian cut-offs: 18.5 se kam underweight, 23 tak normal, 23–24.9 overweight, 25+ obese.
- **BMR**: Mifflin–St Jeor formula.
- **Maintenance calories**: BMR × activity level (1.2 se 1.9).
- **Fat loss**: maintenance se 20% kam. **Muscle gain**: 10% zyada. **Recomp**: maintenance.
- **Protein**: fat loss mein 2.0 g/kg, baaki mein 1.8 g/kg. Zyada weight walon ke liye BMI 25 wale weight se.
- **Fat**: 25–27% calories. **Carbs**: baaki calories.
- Diet plan ke portions solve hote hain taaki din ka total target ke ~3% ke andar rahe.

## Website online kaise karein (free)

**Sabse aasaan, Netlify Drop:**
1. app.netlify.com/drop kholo (free account banana padega).
2. Poora `lift lab` folder us page par drag karo.
3. Aapko ek link milega, jaise `something.netlify.app`. Wahi clients ko bhejo.

Baad mein domain loge to wahi Netlify site par jod sakte ho.

Photos Unsplash se hain (free, business use allowed) aur internet se load hoti hain.
