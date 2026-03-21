import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
  Image, Animated, Linking, Switch,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import {
  getWalletAPI, getTransactionsAPI, depositAPI, withdrawAPI,
  createPaytabsPaymentAPI,
} from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Transaction config ────────────────────────────────────────────────────────

const txConfig: Record<string, { icon: string; label: string; labelAr: string; color: string }> = {
  deposit:    { icon: '💳', label: 'Funds Added',      labelAr: 'إضافة رصيد',   color: colors.success },
  withdrawal: { icon: '🏦', label: 'Withdrawal',       labelAr: 'سحب',          color: colors.error },
  escrow:     { icon: '🔒', label: 'Locked in Escrow', labelAr: 'محتجز',        color: colors.info },
  release:    { icon: '✅', label: 'Payment Received',  labelAr: 'دفعة واردة',   color: colors.success },
  refund:     { icon: '↩️', label: 'Refund',            labelAr: 'استرداد',      color: colors.warning },
}

const isIncoming = (type: string) => ['deposit', 'release', 'refund'].includes(type)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Top-up: PayTabs only (real payments) ─────────────────────────────────────

const PAYTABS_TOPUP = {
  id: 'paytabs' as const,
  icon: '💳',
  name: 'PayTabs',
  nameAr: 'PayTabs',
  detail: 'Visa, Mastercard & regional cards — secure hosted checkout',
  detailAr: 'فيزا، ماستركارد وبطاقات المنطقة — صفحة دفع آمنة',
  brand: 'PayTabs',
  color: '#00A648',
}

const SANDBOX_TOPUP = {
  id: 'sandbox' as const,
  icon: '🧪',
  name: 'Test balance',
  nameAr: 'رصيد تجريبي',
  detail: 'Dev only — no real charge',
  detailAr: 'للتطوير فقط — بدون خصم حقيقي',
  brand: 'TEST',
  color: '#8899AA',
}

const WITHDRAW_METHODS = [
  { id: 'bank',   icon: '🏦', name: 'Bank Transfer', nameAr: 'تحويل بنكي',   detail: 'IBAN: IQ78 0000 0000 0001 2345 678', note: '1-3 business days', noteAr: '١-٣ أيام عمل' },
  { id: 'zain',  icon: '📱', name: 'Zain Cash',     nameAr: 'زين كاش',     detail: '+964 771 234 5678',                  note: 'Instant',           noteAr: 'فوري' },
]

/** Demo only — never store full card numbers; last4 + payout hints for realistic UI */
const STORAGE_DEMO_CARD = 'fursa_sandbox_demo_card_last4'
const STORAGE_W_BANK = 'fursa_sandbox_withdraw_bank'
const STORAGE_W_ZAIN = 'fursa_sandbox_withdraw_zain'

function digitsOnly(s: string) {
  return s.replace(/\D/g, '')
}
function formatCardNumberInput(text: string) {
  const d = digitsOnly(text).slice(0, 16)
  return (d.match(/.{1,4}/g) || []).join(' ')
}
function formatExpiryMmYy(text: string) {
  const d = digitsOnly(text).slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}/${d.slice(2)}`
}
function validateSandboxCardPan(pan: string) {
  const n = digitsOnly(pan).length
  return n >= 13 && n <= 19
}
function validateExpiry(exp: string) {
  const d = digitsOnly(exp)
  if (d.length !== 4) return false
  const m = parseInt(d.slice(0, 2), 10)
  return m >= 1 && m <= 12
}
function validateCvv(c: string) {
  const n = digitsOnly(c).length
  return n >= 3 && n <= 4
}

// ─── Transaction Row ───────────────────────────────────────────────────────────

function TxRow({ tx, isArabic }: { tx: any; isArabic: boolean }) {
  const cfg    = txConfig[tx.type] || txConfig.deposit
  const income = isIncoming(tx.type)
  const label  = isArabic ? cfg.labelAr : cfg.label
  const dir    = isArabic ? 'right' as const : 'left' as const
  return (
    <View style={[styles.txRow, { borderLeftColor: income ? colors.success : colors.error }]}>
      <View style={[styles.txIcon, { backgroundColor: cfg.color + '20' }]}>
        <Text style={{ fontSize: 18 }}>{cfg.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.txLabel, { textAlign: dir }]}>{label}</Text>
        <Text style={[styles.txDesc, { textAlign: dir }]} numberOfLines={1}>
          {tx.description || tx.projectId?.title || '—'}
        </Text>
        <Text style={[styles.txDate, { textAlign: dir }]}>{formatDate(tx.createdAt)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.txAmount, { color: income ? colors.success : colors.error }]}>
          {income ? '+' : '-'}${tx.amount?.toLocaleString()}
        </Text>
        {tx.status === 'pending' && (
          <Text style={styles.txPending}>{isArabic ? 'جاري المعالجة' : 'Pending'}</Text>
        )}
      </View>
    </View>
  )
}

// ─── Deposit Modal ─────────────────────────────────────────────────────────────

function DepositModal({ visible, onClose, onSuccess, isArabic, sandboxActive, sandboxDepositMax, paytabsEnabled }: {
  visible: boolean; onClose: () => void; onSuccess: () => void; isArabic: boolean
  sandboxActive: boolean; sandboxDepositMax: number
  paytabsEnabled: boolean
}) {
  const [step, setStep]       = useState<'amount' | 'card' | 'processing' | 'done'>('amount')
  const [amount, setAmount]   = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [saveCard, setSaveCard] = useState(true)
  const [savedLast4, setSavedLast4] = useState<string | null>(null)
  const [useSavedCardFlow, setUseSavedCardFlow] = useState(false)
  const progress              = useRef(new Animated.Value(0)).current
  const QUICK                 = [50, 100, 200, 500]

  /** Real checkout: PayTabs only */
  const canUseFlow  = sandboxActive || paytabsEnabled
  const sandboxCardUi = sandboxActive && !paytabsEnabled

  const reset = () => {
    setStep('amount')
    setAmount('')
    setCardNumber('')
    setCardExpiry('')
    setCardCvv('')
    setSaveCard(true)
    setUseSavedCardFlow(false)
  }
  const handleClose = () => { reset(); onClose() }

  useEffect(() => {
    if (!visible) return
    setStep('amount')
    setAmount('')
    setCardNumber('')
    setCardExpiry('')
    setCardCvv('')
    setUseSavedCardFlow(false)
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_DEMO_CARD)
        const last4 = raw ? JSON.parse(raw)?.last4 : null
        setSavedLast4(typeof last4 === 'string' && last4.length === 4 ? last4 : null)
      } catch {
        setSavedLast4(null)
      }
    })()
  }, [visible, paytabsEnabled, sandboxActive])

  const openPaytabsCheckout = async (n: number) => {
    const { data } = await createPaytabsPaymentAPI(n)
    const url = data?.redirectUrl
    if (!url) throw new Error('No payment URL')
    handleClose()
    await Linking.openURL(url)
    Alert.alert(
      isArabic ? 'أكمل الدفع' : 'Complete payment',
      isArabic
        ? 'أكمل الدفع في صفحة PayTabs. ثم ارجع للتطبيق وحدّث المحفظة.'
        : 'Complete payment on the PayTabs page, then return and refresh your wallet.',
    )
    onSuccess()
  }

  const goSandboxDeposit = async (n: number) => {
    setStep('processing')
    progress.setValue(0)
    Animated.timing(progress, { toValue: 1, duration: 1800, useNativeDriver: false }).start()
    try {
      await depositAPI(n)
      setTimeout(() => { setStep('done') }, 1900)
    } catch (e: any) {
      setStep(sandboxCardUi ? 'card' : 'amount')
      Alert.alert(isArabic ? 'خطأ' : 'Failed', e?.response?.data?.error || 'Deposit failed')
    }
  }

  const handleAmountContinue = () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) { Alert.alert('', isArabic ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount'); return }
    if (paytabsEnabled) {
      ;(async () => {
        try {
          setStep('processing')
          await openPaytabsCheckout(n)
        } catch (e: any) {
          setStep('amount')
          Alert.alert(isArabic ? 'خطأ' : 'Error', e?.response?.data?.error || e?.message || 'Payment failed')
        }
      })()
      return
    }
    if (sandboxActive) {
      if (n > sandboxDepositMax) {
        Alert.alert(
          isArabic ? 'حد أقصى' : 'Limit',
          isArabic
            ? `الحد الأقصى $${sandboxDepositMax.toLocaleString()} لكل عملية`
            : `Maximum per top-up is $${sandboxDepositMax.toLocaleString()}`,
        )
        return
      }
      setUseSavedCardFlow(!!savedLast4)
      setStep('card')
      return
    }
    Alert.alert(
      isArabic ? 'تفعيل الدفع' : 'Payments not ready',
      isArabic
        ? 'أضِف مفاتيح PayTabs في السيرفر. راجع backend/docs/payments-paytabs.md'
        : 'Add PayTabs keys on the server. See backend/docs/payments-paytabs.md',
    )
  }

  const handleCardPay = async () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) { setStep('amount'); return }

    if (useSavedCardFlow && savedLast4) {
      if (!validateExpiry(cardExpiry) || !validateCvv(cardCvv)) {
        Alert.alert(
          isArabic ? 'تحقق من البيانات' : 'Check details',
          isArabic ? 'أدخل تاريخ انتهاء و CVV صحيحين' : 'Enter valid expiry (MM/YY) and CVV',
        )
        return
      }
    } else {
      if (!validateSandboxCardPan(cardNumber) || !validateExpiry(cardExpiry) || !validateCvv(cardCvv)) {
        Alert.alert(
          isArabic ? 'تحقق من البطاقة' : 'Check card',
          isArabic
            ? 'أدخل رقم بطاقة صالح (13–19 رقماً) وتاريخ انتهاء و CVV'
            : 'Enter a valid card number (13–19 digits), expiry MM/YY, and CVV',
        )
        return
      }
      if (saveCard) {
        const d = digitsOnly(cardNumber)
        try {
          await AsyncStorage.setItem(STORAGE_DEMO_CARD, JSON.stringify({ last4: d.slice(-4) }))
          setSavedLast4(d.slice(-4))
        } catch { /* ignore */ }
      }
    }
    await goSandboxDeposit(n)
  }

  const handleDone = () => { reset(); onSuccess() }

  const dir = isArabic ? 'right' as const : 'left' as const
  const selectedTopup = paytabsEnabled ? PAYTABS_TOPUP : SANDBOX_TOPUP

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>

          {!canUseFlow && (
            <>
              <Text style={[styles.modalTitle, { textAlign: dir }]}>
                {isArabic ? 'الدفع غير جاهز' : 'Payments not configured'}
              </Text>
              <Text style={[styles.modalSub, { textAlign: dir }]}>
                {isArabic
                  ? 'فعّل WALLET_SANDBOX=true للاختبار، أو أضِف مفاتيح PayTabs على السيرفر.'
                  : 'Enable WALLET_SANDBOX=true for test balance, or add PayTabs API keys on the backend.'}
              </Text>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 12 }]} onPress={handleClose}>
                <Text style={styles.actionBtnText}>{isArabic ? 'حسناً' : 'OK'}</Text>
              </TouchableOpacity>
            </>
          )}

          {canUseFlow && step === 'amount' && (
            <>
              <Text style={[styles.modalTitle, { textAlign: dir }]}>
                {paytabsEnabled
                  ? (isArabic ? '💰 إضافة رصيد (PayTabs)' : '💰 Add funds (PayTabs)')
                  : (isArabic ? '💰 رصيد تجريبي' : '💰 Test top-up')}
              </Text>
              <View style={[styles.methodCardSmall, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                <Text style={{ fontSize: 20 }}>{selectedTopup.icon}</Text>
                <Text style={styles.methodCardSmallText}>{isArabic ? selectedTopup.nameAr : selectedTopup.name}</Text>
                <Text style={styles.methodDetail}>{isArabic ? selectedTopup.detailAr : selectedTopup.detail}</Text>
              </View>
              <View style={styles.quickRow}>
                {QUICK.map(q => (
                  <TouchableOpacity key={q}
                    style={[styles.quickBtn, amount === String(q) && styles.quickBtnActive]}
                    onPress={() => setAmount(String(q))}>
                    <Text style={[styles.quickText, amount === String(q) && { color: 'white' }]}>${q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.amountInput}
                placeholder={isArabic ? 'أو أدخل مبلغاً مخصصاً' : 'Or enter custom amount'}
                placeholderTextColor={colors.textDim}
                value={amount} onChangeText={setAmount}
                keyboardType="numeric" textAlign="center"
              />
              <Text style={styles.feeNote}>
                {paytabsEnabled
                  ? (isArabic ? '✓ PayTabs — يُضاف الرصيد بعد نجاح الدفع' : '✓ PayTabs — balance updates after successful payment')
                  : (isArabic
                    ? '✓ تجريبي — الخطوة التالية: إدخال بطاقة (وهمي، لا خصم حقيقي)'
                    : '✓ Demo — next: enter card details (fake; no real charge)')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardDark, flex: 1 }]} onPress={handleClose}>
                  <Text style={styles.actionBtnText}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 2, backgroundColor: colors.success }]}
                  onPress={handleAmountContinue} disabled={!amount}>
                  <Text style={styles.actionBtnText}>
                    {isArabic ? `💳 متابعة $${amount || '0'}` : `💳 Continue $${amount || '0'}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {canUseFlow && step === 'card' && sandboxCardUi && (
            <>
              <Text style={[styles.modalTitle, { textAlign: dir }]}>
                {isArabic ? '💳 بيانات البطاقة (تجريبي)' : '💳 Card details (demo)'}
              </Text>
              <Text style={[styles.demoDisclaimer, { textAlign: dir }]}>
                {isArabic
                  ? 'للعرض فقط. لا يُرسل رقم البطاقة كاملاً للسيرفر. يُحفظ آخر 4 أرقام على الجهاز فقط إذا اخترت الحفظ.'
                  : 'For display only. Full card number is not sent to the server. Only last 4 digits are saved on device if you choose Save.'}
              </Text>
              <Text style={[styles.modalSub, { textAlign: dir, marginBottom: 8 }]}>
                {isArabic ? `المبلغ: $${amount}` : `Amount: $${amount}`}
              </Text>

              {useSavedCardFlow && savedLast4 ? (
                <View style={styles.savedCardBanner}>
                  <Text style={styles.savedCardText}>
                    {isArabic ? `بطاقة محفوظة •••• ${savedLast4}` : `Saved card •••• ${savedLast4}`}
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      setUseSavedCardFlow(false)
                      try { await AsyncStorage.removeItem(STORAGE_DEMO_CARD) } catch { /* ignore */ }
                      setSavedLast4(null)
                    }}>
                    <Text style={styles.changeCardLink}>
                      {isArabic ? 'استخدام بطاقة أخرى' : 'Use different card'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  style={styles.cardInput}
                  placeholder={isArabic ? 'رقم البطاقة' : 'Card number'}
                  placeholderTextColor={colors.textDim}
                  value={cardNumber}
                  onChangeText={(t) => setCardNumber(formatCardNumberInput(t))}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              )}

              <View style={styles.cardRow}>
                <TextInput
                  style={[styles.cardInput, { flex: 1 }]}
                  placeholder="MM/YY"
                  placeholderTextColor={colors.textDim}
                  value={cardExpiry}
                  onChangeText={(t) => setCardExpiry(formatExpiryMmYy(t))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.cardInput, { flex: 1, marginStart: 10 }]}
                  placeholder="CVV"
                  placeholderTextColor={colors.textDim}
                  value={cardCvv}
                  onChangeText={(t) => setCardCvv(digitsOnly(t).slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
              </View>

              {!(useSavedCardFlow && savedLast4) && (
                <View style={[styles.saveRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.saveRowLabel}>
                    {isArabic ? 'حفظ آخر 4 أرقام على الجهاز' : 'Save last 4 digits on device'}
                  </Text>
                  <Switch value={saveCard} onValueChange={setSaveCard} trackColor={{ false: colors.border, true: colors.primary + '88' }} thumbColor={saveCard ? colors.primary : colors.textDim} />
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardDark, flex: 1 }]} onPress={() => setStep('amount')}>
                  <Text style={styles.actionBtnText}>{isArabic ? '← رجوع' : '← Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 2, backgroundColor: colors.success }]} onPress={handleCardPay}>
                  <Text style={styles.actionBtnText}>{isArabic ? '✓ تأكيد وإضافة الرصيد' : '✓ Confirm & add funds'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {canUseFlow && step === 'processing' && (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 16 }]}>
                {paytabsEnabled
                  ? (isArabic ? 'جاري فتح PayTabs...' : 'Opening PayTabs...')
                  : sandboxCardUi
                    ? (isArabic ? 'جاري التحقق من البطاقة (تجريبي)...' : 'Authorizing card (demo)...')
                    : (isArabic ? 'جاري المعالجة...' : 'Processing...')}
              </Text>
              {!paytabsEnabled && (
                <>
                  <View style={styles.progressBar}>
                    <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 8 }}>
                    {isArabic ? 'يرجى الانتظار' : 'Please wait'}
                  </Text>
                </>
              )}
            </View>
          )}

          {canUseFlow && step === 'done' && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 60, marginBottom: 12 }}>✅</Text>
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>
                {isArabic ? 'تمت الإضافة!' : 'Funds added!'}
              </Text>
              <Text style={[styles.modalSub, { textAlign: 'center', marginBottom: 4 }]}>
                {isArabic ? `+$${amount} إلى محفظتك` : `+$${amount} added to your wallet`}
              </Text>
              <View style={styles.receiptBox}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'المبلغ' : 'Amount'}</Text>
                  <Text style={styles.receiptValue}>${parseFloat(amount).toFixed(2)}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'الطريقة' : 'Method'}</Text>
                  <Text style={styles.receiptValue}>{isArabic ? selectedTopup.nameAr : selectedTopup.name}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'الحالة' : 'Status'}</Text>
                  <Text style={[styles.receiptValue, { color: colors.success }]}>{isArabic ? '✓ ناجح' : '✓ Successful'}</Text>
                </View>
                <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'الوقت' : 'Time'}</Text>
                  <Text style={styles.receiptValue}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, width: '100%', marginTop: 16 }]} onPress={handleDone}>
                <Text style={styles.actionBtnText}>{isArabic ? 'تم ✓' : 'Done ✓'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  )
}

// ─── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({ visible, onClose, onSuccess, balance, isArabic }: {
  visible: boolean; onClose: () => void; onSuccess: () => void; balance: number; isArabic: boolean
}) {
  const [step, setStep]       = useState<'dest' | 'payout' | 'amount' | 'processing' | 'done'>('dest')
  const [dest, setDest]       = useState<string | null>(null)
  const [amount, setAmount]   = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [zainPhone, setZainPhone] = useState('')
  const [savePayout, setSavePayout] = useState(true)
  const progress              = useRef(new Animated.Value(0)).current

  const reset = () => {
    setStep('dest')
    setDest(null)
    setAmount('')
    setBankHolder('')
    setBankIban('')
    setZainPhone('')
    setSavePayout(true)
  }
  const handleClose = () => { reset(); onClose() }
  const selectedDest = dest ? WITHDRAW_METHODS.find(m => m.id === dest) : null

  useEffect(() => {
    if (!visible || !dest) return
    ;(async () => {
      try {
        const key = dest === 'bank' ? STORAGE_W_BANK : STORAGE_W_ZAIN
        const raw = await AsyncStorage.getItem(key)
        if (!raw) return
        const j = JSON.parse(raw)
        if (dest === 'bank' && j?.holder && j?.iban) {
          setBankHolder(String(j.holder))
          setBankIban(String(j.iban))
        }
        if (dest === 'zain' && j?.phone) setZainPhone(String(j.phone))
      } catch { /* ignore */ }
    })()
  }, [visible, dest])

  const handleWithdraw = async () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) { Alert.alert('', isArabic ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount'); return }
    if (n > balance) {
      Alert.alert(isArabic ? 'رصيد غير كافٍ' : 'Insufficient Balance', isArabic ? `رصيدك المتاح $${balance}` : `Your available balance is $${balance}`)
      return
    }
    setStep('processing')
    progress.setValue(0)
    Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }).start()
    try {
      await withdrawAPI(n)
      setTimeout(() => { setStep('done') }, 2100)
    } catch (e: any) {
      setStep('amount')
      Alert.alert(isArabic ? 'خطأ' : 'Failed', e?.response?.data?.error || 'Insufficient balance')
    }
  }

  const goPayoutNext = async () => {
    if (dest === 'bank') {
      const h = bankHolder.trim()
      const ib = bankIban.trim().replace(/\s/g, '')
      if (h.length < 2 || ib.length < 8) {
        Alert.alert(
          isArabic ? 'بيانات ناقصة' : 'Missing details',
          isArabic ? 'أدخل اسم صاحب الحساب ورقم الحساب أو الآيبان' : 'Enter account holder name and IBAN / account number',
        )
        return
      }
      if (savePayout) {
        try {
          await AsyncStorage.setItem(STORAGE_W_BANK, JSON.stringify({ holder: h, iban: ib }))
        } catch { /* ignore */ }
      }
    }
    if (dest === 'zain') {
      const ph = digitsOnly(zainPhone)
      if (ph.length < 8) {
        Alert.alert(isArabic ? 'رقم غير صالح' : 'Invalid number', isArabic ? 'أدخل رقم جوال صالح' : 'Enter a valid mobile number')
        return
      }
      if (savePayout) {
        try {
          await AsyncStorage.setItem(STORAGE_W_ZAIN, JSON.stringify({ phone: zainPhone.trim() }))
        } catch { /* ignore */ }
      }
    }
    setStep('amount')
  }

  const dir = isArabic ? 'right' as const : 'left' as const

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>

          {/* ── Step 1: Choose Destination ── */}
          {step === 'dest' && (
            <>
              <Text style={[styles.modalTitle, { textAlign: dir }]}>
                {isArabic ? '🏦 إرسال إلى' : '🏦 Withdraw To'}
              </Text>
              <Text style={[styles.modalSub, { textAlign: dir }]}>
                {isArabic ? 'اختر وجهة سحب أرباحك' : 'Choose where to send your earnings'}
              </Text>
              {WITHDRAW_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodCard, dest === m.id && styles.methodCardActive]}
                  onPress={() => setDest(m.id)}
                >
                  <View style={[styles.methodIcon, { backgroundColor: colors.info + '22' }]}>
                    <Text style={{ fontSize: 24 }}>{m.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.methodName}>{isArabic ? m.nameAr : m.name}</Text>
                    <Text style={styles.methodDetail} numberOfLines={1}>{m.detail}</Text>
                    <Text style={[styles.methodNote]}>
                      ⏱ {isArabic ? m.noteAr : m.note}
                    </Text>
                  </View>
                  <View style={[styles.methodRadio, dest === m.id && styles.methodRadioActive]}>
                    {dest === m.id && <View style={styles.methodRadioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardDark, flex: 1 }]} onPress={handleClose}>
                  <Text style={styles.actionBtnText}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 1, backgroundColor: dest ? colors.warning : colors.textDim }]}
                  onPress={() => dest && setStep('payout')} disabled={!dest}
                >
                  <Text style={styles.actionBtnText}>{isArabic ? 'التالي' : 'Next →'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 2: Payout details (demo — looks real, sandbox only) ── */}
          {step === 'payout' && selectedDest && (
            <>
              <Text style={[styles.modalTitle, { textAlign: dir }]}>
                {isArabic ? '📋 وجهة استلام الأموال' : '📋 Payout details'}
              </Text>
              <Text style={[styles.demoDisclaimer, { textAlign: dir }]}>
                {isArabic
                  ? 'تجريبي: لإكمال التجربة فقط. لا يُرسل للبنك حقيقة في وضع الاختبار.'
                  : 'Demo: for a realistic flow. Not sent to a real bank in test mode.'}
              </Text>
              {dest === 'bank' && (
                <>
                  <TextInput
                    style={styles.cardInput}
                    placeholder={isArabic ? 'اسم صاحب الحساب' : 'Account holder name'}
                    placeholderTextColor={colors.textDim}
                    value={bankHolder}
                    onChangeText={setBankHolder}
                  />
                  <TextInput
                    style={[styles.cardInput, { marginTop: 10 }]}
                    placeholder={isArabic ? 'IBAN أو رقم الحساب' : 'IBAN or account number'}
                    placeholderTextColor={colors.textDim}
                    value={bankIban}
                    onChangeText={setBankIban}
                    autoCapitalize="characters"
                  />
                </>
              )}
              {dest === 'zain' && (
                <TextInput
                  style={styles.cardInput}
                  placeholder={isArabic ? 'رقم زين كاش' : 'Zain Cash number'}
                  placeholderTextColor={colors.textDim}
                  value={zainPhone}
                  onChangeText={setZainPhone}
                  keyboardType="phone-pad"
                />
              )}
              <View style={[styles.saveRow, { flexDirection: isArabic ? 'row-reverse' : 'row', marginTop: 12 }]}>
                <Text style={styles.saveRowLabel}>{isArabic ? 'حفظ على الجهاز' : 'Save on device'}</Text>
                <Switch value={savePayout} onValueChange={setSavePayout} trackColor={{ false: colors.border, true: colors.warning + '88' }} thumbColor={savePayout ? colors.warning : colors.textDim} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardDark, flex: 1 }]} onPress={() => setStep('dest')}>
                  <Text style={styles.actionBtnText}>{isArabic ? '← رجوع' : '← Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 2, backgroundColor: colors.warning }]} onPress={goPayoutNext}>
                  <Text style={styles.actionBtnText}>{isArabic ? 'التالي → المبلغ' : 'Next → Amount'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 3: Enter Amount ── */}
          {step === 'amount' && selectedDest && (
            <>
              <Text style={[styles.modalTitle, { textAlign: dir }]}>
                {isArabic ? '💰 مبلغ السحب' : '💰 Withdrawal Amount'}
              </Text>
              <View style={[styles.methodCardSmall, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                <Text style={{ fontSize: 20 }}>{selectedDest.icon}</Text>
                <Text style={styles.methodCardSmallText}>{isArabic ? selectedDest.nameAr : selectedDest.name}</Text>
              </View>
              <View style={styles.balanceHint}>
                <Text style={styles.balanceHintText}>
                  {isArabic ? `الرصيد المتاح للسحب: $${balance.toFixed(2)}` : `Available to withdraw: $${balance.toFixed(2)}`}
                </Text>
              </View>
              <TextInput
                style={styles.amountInput}
                placeholder={isArabic ? 'أدخل المبلغ' : 'Enter amount'}
                placeholderTextColor={colors.textDim}
                value={amount} onChangeText={setAmount}
                keyboardType="numeric" textAlign="center"
              />
              <Text style={styles.feeNote}>
                {isArabic
                  ? `⏱ الوقت المتوقع للوصول: ${selectedDest.noteAr}`
                  : `⏱ Estimated arrival: ${selectedDest.note}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardDark, flex: 1 }]} onPress={() => setStep('payout')}>
                  <Text style={styles.actionBtnText}>{isArabic ? '← رجوع' : '← Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 2, backgroundColor: colors.warning }]}
                  onPress={handleWithdraw} disabled={!amount}>
                  <Text style={styles.actionBtnText}>
                    {isArabic ? `سحب $${amount || '0'}` : `Withdraw $${amount || '0'}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 4: Processing ── */}
          {step === 'processing' && (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={colors.warning} size="large" />
              <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 16 }]}>
                {isArabic ? 'جاري إرسال طلب السحب...' : 'Submitting Withdrawal...'}
              </Text>
              <Text style={[styles.modalSub, { textAlign: 'center', marginBottom: 20 }]}>
                {isArabic ? 'سيتم تأكيد الطلب خلال لحظات' : 'Your request is being confirmed'}
              </Text>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { backgroundColor: colors.warning, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              </View>
            </View>
          )}

          {/* ── Step 5: Requested ── */}
          {step === 'done' && selectedDest && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 60, marginBottom: 12 }}>🕐</Text>
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>
                {isArabic ? 'تم استلام طلب السحب!' : 'Withdrawal Requested!'}
              </Text>
              <Text style={[styles.modalSub, { textAlign: 'center', marginBottom: 4 }]}>
                {isArabic
                  ? `ستصل أموالك إلى ${selectedDest.nameAr} خلال ${selectedDest.noteAr}`
                  : `Your funds will arrive via ${selectedDest.name} within ${selectedDest.note}`}
              </Text>
              <View style={styles.receiptBox}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'المبلغ' : 'Amount'}</Text>
                  <Text style={styles.receiptValue}>${parseFloat(amount).toFixed(2)}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'الوجهة' : 'Destination'}</Text>
                  <Text style={styles.receiptValue}>{isArabic ? selectedDest.nameAr : selectedDest.name}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'الحساب' : 'Account'}</Text>
                  <Text style={styles.receiptValue} numberOfLines={1}>{selectedDest.detail}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'المدة المتوقعة' : 'ETA'}</Text>
                  <Text style={[styles.receiptValue, { color: colors.warning }]}>{isArabic ? selectedDest.noteAr : selectedDest.note}</Text>
                </View>
                <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.receiptLabel}>{isArabic ? 'الحالة' : 'Status'}</Text>
                  <Text style={[styles.receiptValue, { color: colors.warning }]}>{isArabic ? '🕐 قيد المعالجة' : '🕐 Pending'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary, width: '100%', marginTop: 16 }]}
                onPress={() => { reset(); onSuccess() }}>
                <Text style={styles.actionBtnText}>{isArabic ? 'تم ✓' : 'Done ✓'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  )
}

// ─── How It Works Banner ───────────────────────────────────────────────────────

function HowItWorks({ isClient, isArabic }: { isClient: boolean; isArabic: boolean }) {
  const dir = isArabic ? 'right' as const : 'left' as const
  const steps = isClient
    ? (isArabic
        ? ['💳 أضف رصيداً لمحفظتك', '🔒 يُحتجز المبلغ عند قبول عرض', '✅ يُرسل المبلغ للمستقل بعد التأكيد']
        : ['💳 Add funds to your wallet', '🔒 Funds lock in escrow when you hire', '✅ Admin releases payment after review'])
    : (isArabic
        ? ['📋 قدم عروضاً على المشاريع', '🏁 أكمل المشروع لنقل المبلغ للإدارة', '💸 اسحب أرباحك بعد موافقة الإدارة']
        : ['📋 Submit proposals on projects', '🏁 Complete work — admin holds payment', '💸 Withdraw your earnings to your bank'])
  return (
    <View style={styles.howBox}>
      <Text style={[styles.howTitle, { textAlign: dir }]}>
        {isArabic ? '⚡ كيف تعمل المحفظة؟' : '⚡ How Does It Work?'}
      </Text>
      {steps.map((s, i) => (
        <View key={i} style={[styles.howRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
          <View style={styles.howStep}><Text style={styles.howStepText}>{i + 1}</Text></View>
          <Text style={[styles.howStepLabel, { textAlign: dir }]}>{s}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { user }   = useAuth()
  const { socket } = useSocket()
  const { tr, isArabic, lang, toggleLang } = useLang()
  const dir = isArabic ? 'right' as const : 'left' as const
  const isClient = user?.role === 'client'

  const [wallet, setWallet]             = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [showDeposit, setShowDeposit]   = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [wRes, tRes] = await Promise.all([getWalletAPI(), getTransactionsAPI()])
      setWallet(wRes.data)
      setTransactions(Array.isArray(tRes.data) ? tRes.data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!socket) return
    socket.on('paymentReleased', fetchData)
    socket.on('escrowLocked', fetchData)
    return () => { socket.off('paymentReleased', fetchData); socket.off('escrowLocked', fetchData) }
  }, [socket, fetchData])

  useEffect(() => {
    const sub = Linking.addEventListener('url', () => { fetchData() })
    return () => { sub.remove() }
  }, [fetchData])

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false) }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  const balance     = wallet?.balance     ?? 0
  const escrow      = wallet?.escrow      ?? 0
  const totalEarned = wallet?.totalEarned ?? 0
  /** Backend omits flag on old deploys — treat as sandbox so Add Funds keeps working */
  const sandboxActive = wallet?.sandboxMode !== false
  const sandboxDepositMax = typeof wallet?.sandboxDepositMax === 'number' ? wallet.sandboxDepositMax : 50000
  const paytabsEnabled = wallet?.paytabsEnabled === true

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.headerTitle}>{isArabic ? 'المحفظة' : 'Wallet'}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* ── Balance Card ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabelTop}>
            {isArabic ? (isClient ? 'الرصيد المتاح للإنفاق' : 'الرصيد المتاح للسحب') : (isClient ? 'Available to Spend' : 'Available to Withdraw')}
          </Text>
          <Text style={styles.balanceAmount}>${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>

          <View style={styles.balanceInfoRow}>
            {isClient ? (
              <>
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>{isArabic ? '🔒 محتجز' : '🔒 In Escrow'}</Text>
                  <Text style={[styles.balanceInfoValue, { color: colors.info }]}>${escrow.toLocaleString()}</Text>
                  <Text style={styles.balanceInfoSub}>{isArabic ? 'للمشاريع النشطة' : 'for active projects'}</Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>{isArabic ? '💸 إجمالي الإنفاق' : '💸 Total Spent'}</Text>
                  <Text style={[styles.balanceInfoValue, { color: '#ffd580' }]}>${totalEarned.toLocaleString()}</Text>
                  <Text style={styles.balanceInfoSub}>{isArabic ? 'على المشاريع' : 'on projects'}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>{isArabic ? '🏆 إجمالي الأرباح' : '🏆 Total Earned'}</Text>
                  <Text style={[styles.balanceInfoValue, { color: colors.success }]}>${totalEarned.toLocaleString()}</Text>
                  <Text style={styles.balanceInfoSub}>{isArabic ? 'منذ الانضمام' : 'since joining'}</Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>{isArabic ? '🔒 قيد المعالجة' : '🔒 In Review'}</Text>
                  <Text style={[styles.balanceInfoValue, { color: colors.warning }]}>${escrow.toLocaleString()}</Text>
                  <Text style={styles.balanceInfoSub}>{isArabic ? 'ينتظر إفراج الإدارة' : 'pending admin release'}</Text>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.cardActions}>
            {isClient && (
              <TouchableOpacity style={[styles.cardBtn, styles.depositBtn]} onPress={() => setShowDeposit(true)}>
                <Text style={styles.cardBtnIcon}>💳</Text>
                <Text style={styles.cardBtnText}>{isArabic ? 'إضافة رصيد' : 'Add Funds'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.cardBtn, styles.withdrawBtn]} onPress={() => setShowWithdraw(true)}>
              <Text style={styles.cardBtnIcon}>🏦</Text>
              <Text style={styles.cardBtnText}>{isArabic ? 'سحب' : isClient ? 'Withdraw' : 'Withdraw to Bank'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── How It Works ── */}
        <HowItWorks isClient={isClient} isArabic={isArabic} />

        {/* ── Payment Methods ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: dir }]}>
            {isArabic ? 'طرق الدفع المرتبطة' : 'Linked Payment Methods'}
          </Text>
          {paytabsEnabled && (
            <Text style={[styles.pmLiveNote, { textAlign: dir }]}>
              {isArabic ? '✓ الدفع عبر PayTabs مفعّل' : '✓ PayTabs checkout enabled'}
            </Text>
          )}
          <View style={styles.pmCard}>
            <View style={[styles.pmIconBox, { backgroundColor: PAYTABS_TOPUP.color + '22' }]}>
              <Text style={{ fontSize: 22 }}>{PAYTABS_TOPUP.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pmName}>{isArabic ? PAYTABS_TOPUP.nameAr : PAYTABS_TOPUP.name}</Text>
              <Text style={styles.pmDetail}>{isArabic ? PAYTABS_TOPUP.detailAr : PAYTABS_TOPUP.detail}</Text>
            </View>
            <View style={[styles.pmBrand, { backgroundColor: PAYTABS_TOPUP.color + '22' }]}>
              <Text style={[styles.pmBrandText, { color: PAYTABS_TOPUP.color }]}>{PAYTABS_TOPUP.brand}</Text>
            </View>
          </View>
        </View>

        {/* ── Transaction History ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: dir }]}>
            {isArabic ? 'سجل المعاملات' : 'Transaction History'}
          </Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 44, marginBottom: 10 }}>💸</Text>
              <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                {isArabic ? 'لا توجد معاملات بعد' : 'No transactions yet'}
              </Text>
              <Text style={[styles.emptySubText, { textAlign: 'center', marginTop: 4 }]}>
                {isArabic
                  ? (isClient ? 'أضف رصيداً لتبدأ' : 'ستظهر أرباحك هنا')
                  : (isClient ? 'Add funds to get started' : 'Your earnings will appear here')}
              </Text>
            </View>
          ) : (
            transactions.map((tx, i) => <TxRow key={tx._id || i} tx={tx} isArabic={isArabic} />)
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <DepositModal
        visible={showDeposit}
        onClose={() => setShowDeposit(false)}
        onSuccess={() => { setShowDeposit(false); fetchData() }}
        isArabic={isArabic}
        sandboxActive={sandboxActive}
        sandboxDepositMax={sandboxDepositMax}
        paytabsEnabled={paytabsEnabled}
      />
      <WithdrawModal
        visible={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onSuccess={() => { setShowWithdraw(false); fetchData() }}
        balance={balance}
        isArabic={isArabic}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 14, paddingHorizontal: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  logoBox:     { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  logo:        { width: 30, height: 30 },
  headerTitle: { flex: 1, color: colors.text, fontSize: font.xl, fontWeight: '800' },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  // Balance card
  balanceCard:      { margin: spacing.md, backgroundColor: '#1A3A5C', borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: '#2A5080' },
  balanceLabelTop:  { color: 'rgba(255,255,255,0.65)', fontSize: font.sm, marginBottom: 4 },
  balanceAmount:    { color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: -1, marginBottom: 12 },
  balanceInfoRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.lg, padding: 12, marginBottom: 16 },
  balanceInfoItem:  { flex: 1, alignItems: 'center' },
  balanceInfoLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 3 },
  balanceInfoValue: { color: '#fff', fontWeight: '700', fontSize: font.base },
  balanceInfoSub:   { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 },
  balanceDivider:   { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },

  cardActions:  { flexDirection: 'row', gap: 12 },
  cardBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 12, gap: 6 },
  withdrawBtn:  { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  depositBtn:   { backgroundColor: colors.success },
  cardBtnIcon:  { fontSize: 16 },
  cardBtnText:  { color: '#fff', fontWeight: '700', fontSize: font.base },

  // How it works
  howBox:       { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  howTitle:     { color: colors.text, fontWeight: '800', fontSize: font.base, marginBottom: 12 },
  howRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  howStep:      { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howStepText:  { color: '#fff', fontSize: 11, fontWeight: '800' },
  howStepLabel: { color: colors.textMuted, fontSize: font.sm, flex: 1 },

  // Sections
  section:      { marginHorizontal: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.sm },
  pmLiveNote: { color: colors.success, fontSize: font.sm, marginBottom: spacing.sm, fontWeight: '600' },

  // Payment methods
  pmCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  pmIconBox:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pmName:     { color: colors.text, fontWeight: '700', fontSize: font.base },
  pmDetail:   { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  pmBrand:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  pmBrandText:{ fontSize: 11, fontWeight: '800' },

  // Transactions
  txRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, gap: spacing.sm },
  txIcon:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txLabel:    { color: colors.text, fontWeight: '600', fontSize: font.base },
  txDesc:     { color: colors.textMuted, fontSize: font.sm },
  txDate:     { color: colors.textDim, fontSize: 11, marginTop: 2 },
  txAmount:   { fontWeight: '800', fontSize: font.lg },
  txPending:  { color: colors.warning, fontSize: 10, marginTop: 2 },

  emptyState:   { alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
  emptyText:    { color: colors.textMuted, fontSize: font.base },
  emptySubText: { color: colors.textDim, fontSize: font.sm },

  // Modal
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:   { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40, maxHeight: '90%' },
  modalTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: 4 },
  modalSub:   { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.md },

  // Payment method cards in modal
  methodCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: colors.border },
  methodCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  methodIcon:       { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodName:       { color: colors.text, fontWeight: '700', fontSize: font.base },
  methodDetail:     { color: colors.textMuted, fontSize: font.sm, marginTop: 2, flex: 1 },
  methodNote:       { color: colors.info, fontSize: 11, marginTop: 3 },
  methodRadio:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  methodRadioActive:{ borderColor: colors.primary },
  methodRadioDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  methodCardSmall:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: colors.border },
  methodCardSmallText: { color: colors.text, fontWeight: '700', fontSize: font.base },

  quickRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickBtn:   { flex: 1, paddingVertical: 10, backgroundColor: colors.bg, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, minWidth: 60 },
  quickBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  quickText:  { color: colors.textMuted, fontWeight: '700', fontSize: font.base },
  amountInput:{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: font.xl, fontWeight: '700', paddingHorizontal: spacing.md, paddingVertical: 14, marginBottom: 8 },
  feeNote:    { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', marginBottom: 4 },

  balanceHint:     { backgroundColor: colors.success + '18', borderRadius: radius.md, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: colors.success + '40' },
  balanceHintText: { color: colors.success, fontWeight: '700', fontSize: font.sm, textAlign: 'center' },

  actionBtn:    { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  actionBtnText:{ color: 'white', fontWeight: '700', fontSize: font.base },

  // Progress bar
  progressBar:  { width: '100%', height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },

  // Receipt box
  receiptBox:  { width: '100%', backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  receiptRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  receiptLabel:{ color: colors.textMuted, fontSize: font.sm },
  receiptValue:{ color: colors.text, fontWeight: '700', fontSize: font.sm, maxWidth: 180, textAlign: 'right' },

  demoDisclaimer: { color: colors.warning, fontSize: font.sm, marginBottom: spacing.sm, lineHeight: 20 },
  cardInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  cardRow: { flexDirection: 'row', marginTop: 10 },
  saveRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  saveRowLabel: { color: colors.textMuted, fontSize: font.sm, flex: 1 },
  savedCardBanner: {
    backgroundColor: colors.cardDark,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedCardText: { color: colors.text, fontWeight: '700', fontSize: font.base },
  changeCardLink: { color: colors.primary, fontSize: font.sm, fontWeight: '700', marginTop: 8 },
})
