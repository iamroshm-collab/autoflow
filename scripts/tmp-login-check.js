const run = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9496538284', requestOtpOnly: true, deviceId: 'debug-device-1' }),
    })
    const data = await response.json().catch(() => ({}))
    console.log(JSON.stringify({ status: response.status, ok: response.ok, data }, null, 2))
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}
run()
