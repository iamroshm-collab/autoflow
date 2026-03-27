const run = async () => {
  const mobile = '9496538284'
  const deviceId = 'debug-device-1'

  const otpRequest = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, requestOtpOnly: true, deviceId }),
  })
  const otpData = await otpRequest.json().catch(() => ({}))

  const verify = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, otp: otpData.otp, deviceId }),
  })
  const verifyData = await verify.json().catch(() => ({}))

  console.log(JSON.stringify({
    otpRequest: { status: otpRequest.status, ok: otpRequest.ok, data: otpData },
    verify: { status: verify.status, ok: verify.ok, data: verifyData },
  }, null, 2))
}

run().catch((error) => {
  console.error(String(error))
  process.exitCode = 1
})
