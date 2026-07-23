'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Info,
  CheckCircle2,
  AlertCircle,
  Scale,
  Receipt,
  PiggyBank,
  RefreshCcw,
  CalendarDays,
  ShieldCheck,
  Landmark,
  Wallet,
  Minus,
  Home as HomeIcon
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'

// ─── Tax Slab Data ───────────────────────────────────────────────────────────

interface TaxSlab {
  min: number
  max: number | null
  fixedTax: number
  rate: number
  excessOver: number
}

const TAX_SLABS_2024_25: TaxSlab[] = [
  { min: 0, max: 600000, fixedTax: 0, rate: 0, excessOver: 0 },
  { min: 600001, max: 1200000, fixedTax: 0, rate: 0.05, excessOver: 600000 },
  { min: 1200001, max: 2200000, fixedTax: 30000, rate: 0.15, excessOver: 1200000 },
  { min: 2200001, max: 3200000, fixedTax: 180000, rate: 0.25, excessOver: 2200000 },
  { min: 3200001, max: 4100000, fixedTax: 430000, rate: 0.30, excessOver: 3200000 },
  { min: 4100001, max: null, fixedTax: 700000, rate: 0.35, excessOver: 4100000 },
]

const TAX_SLABS_2025_26: TaxSlab[] = [
  { min: 0, max: 600000, fixedTax: 0, rate: 0, excessOver: 0 },
  { min: 600001, max: 1200000, fixedTax: 0, rate: 0.01, excessOver: 600000 },
  { min: 1200001, max: 2200000, fixedTax: 6000, rate: 0.11, excessOver: 1200000 },
  { min: 2200001, max: 3200000, fixedTax: 116000, rate: 0.23, excessOver: 2200000 },
  { min: 3200001, max: 4100000, fixedTax: 346000, rate: 0.30, excessOver: 3200000 },
  { min: 4100001, max: null, fixedTax: 616000, rate: 0.35, excessOver: 4100000 },
]

const TAX_SLABS_2026_27: TaxSlab[] = [
  { min: 0, max: 600000, fixedTax: 0, rate: 0, excessOver: 0 },
  { min: 600001, max: 1200000, fixedTax: 0, rate: 0.01, excessOver: 600000 },
  { min: 1200001, max: 2200000, fixedTax: 6000, rate: 0.11, excessOver: 1200000 },
  { min: 2200001, max: 3200000, fixedTax: 116000, rate: 0.20, excessOver: 2200000 },
  { min: 3200001, max: 4100000, fixedTax: 316000, rate: 0.25, excessOver: 3200000 },
  { min: 4100001, max: 5600000, fixedTax: 541000, rate: 0.29, excessOver: 4100000 },
  { min: 5600001, max: 7000000, fixedTax: 976000, rate: 0.32, excessOver: 5600000 },
  { min: 7000001, max: null, fixedTax: 1424000, rate: 0.35, excessOver: 7000000 },
]

// ─── Calculation Functions ──────────────────────────────────────────────────

function calculateTax(taxableIncome: number, slabs: TaxSlab[]): number {
  if (taxableIncome <= 0) return 0
  for (const slab of slabs) {
    if (slab.max === null || taxableIncome <= slab.max) {
      if (taxableIncome <= slab.min) return 0
      return slab.fixedTax + (taxableIncome - slab.excessOver) * slab.rate
    }
  }
  return 0
}

function calculateAnnualIncome(monthlyGross: number, additions: number, taxablePF: number): number {
  return monthlyGross * 11.2 + additions + taxablePF
}

function calculateProvidentFund(monthlyGross: number) {
  const monthlyPF = monthlyGross * (66.67 / 100) * (8.33 / 100)
  const annualPF = monthlyPF * 12
  const exemptAmount = 150000
  const taxablePF = annualPF > exemptAmount ? annualPF - exemptAmount : 0
  return { monthlyPF, annualPF, exemptAmount, taxablePF }
}

// Super Tax: FY 2024-25 = 10%, FY 2025-26 = 9% (on annual tax, if income > 10M)
const SUPER_TAX_RATE = 0.09
const SUPER_TAX_THRESHOLD = 10000000

function getSlabBreakdown(taxableIncome: number, slabs: TaxSlab[]) {
  const breakdown: { slab: string; taxable: number; rate: number; tax: number }[] = []
  let remaining = taxableIncome

  for (const slab of slabs) {
    const rangeStart = slab.excessOver
    const rangeEnd = slab.max ?? Infinity

    if (remaining <= 0) break

    const slabMin = Math.max(rangeStart, 0)
    const taxableInThisSlab = Math.min(remaining, rangeEnd - rangeStart)

    if (taxableInThisSlab > 0) {
      breakdown.push({
        slab: slab.max ? `${slab.excessOver.toLocaleString()} - ${slab.max.toLocaleString()}` : `Above ${slab.excessOver.toLocaleString()}`,
        taxable: taxableInThisSlab,
        rate: slab.rate,
        tax: taxableInThisSlab * slab.rate,
      })
      remaining -= taxableInThisSlab
    }
  }

  return breakdown
}

function getEffectiveRate(tax: number, income: number): number {
  if (income <= 0) return 0
  return (tax / income) * 100
}

function formatPKR(amount: number): string {
  return Math.round(amount).toLocaleString('en-PK')
}

// ─── Animation Variants ─────────────────────────────────────────────────────

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Home() {
  const [monthlyGross, setMonthlyGross] = useState<string>('')
  const [bonus, setBonus] = useState<string>('')
  const [specialAllowance, setSpecialAllowance] = useState<string>('')
  const [arrears, setArrears] = useState<string>('')
  const [annualIncrement, setAnnualIncrement] = useState<string>('')
  const [incrementWef, setIncrementWef] = useState<string>('')
  const [otherIncome, setOtherIncome] = useState<string>('')
  const [showResults, setShowResults] = useState(false)
  const [activeSlabYear, setActiveSlabYear] = useState('2026-27')
  const [expandedSlabs, setExpandedSlabs] = useState<Record<string, boolean>>({
    '2024-25': false,
    '2025-26': false,
    '2026-27': true,
  })
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [hasProvidentFund, setHasProvidentFund] = useState(false)
  const FIXED_EOBI = 400

  const parseNum = (val: string) => parseFloat(val) || 0

  const additionalIncome = useMemo(() => {
    return parseNum(bonus) + parseNum(specialAllowance) + parseNum(arrears) + parseNum(otherIncome)
  }, [bonus, specialAllowance, arrears, otherIncome])

  // Provident Fund calculation (before & after increment)
  const increment = parseNum(annualIncrement)
  const wefMonth = parseInt(incrementWef) || 0
  const newGross = increment > 0 ? parseNum(monthlyGross) + increment : 0

  const pfData = useMemo(() => {
    const gross = parseNum(monthlyGross)
    if (!hasProvidentFund || gross <= 0) return null
    return calculateProvidentFund(gross)
  }, [monthlyGross, hasProvidentFund])

  const pfDataNew = useMemo(() => {
    if (!hasProvidentFund || newGross <= 0) return null
    return calculateProvidentFund(newGross)
  }, [hasProvidentFund, newGross])

  const taxablePF = pfData ? pfData.taxablePF : 0
  const taxablePFNew = pfDataNew ? pfDataNew.taxablePF : 0

  const FY_MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

  const results = useMemo(() => {
    const gross = parseNum(monthlyGross)
    if (gross <= 0) return null

    const hasIncrement = increment > 0 && wefMonth > 0 && wefMonth <= 12
    const pf = pfData ? pfData.monthlyPF : 0
    const pfNew = pfDataNew ? pfDataNew.monthlyPF : 0

    // ── BEFORE increment (baseline) ──
    const annualIncomeBefore = gross * 11.2 + additionalIncome + taxablePF
    const baseTaxBefore2526 = calculateTax(annualIncomeBefore, TAX_SLABS_2025_26)
    const superTaxBefore2526 = annualIncomeBefore > SUPER_TAX_THRESHOLD ? Math.round(baseTaxBefore2526 * SUPER_TAX_RATE) : 0
    const taxBefore2526 = baseTaxBefore2526 + superTaxBefore2526
    const taxBefore2627 = calculateTax(annualIncomeBefore, TAX_SLABS_2026_27)
    const takeHomeBefore = gross - pf - taxBefore2627 / 12 - FIXED_EOBI

    // ── AFTER increment (pro-rated) ──
    let annualIncomeAfter: number
    if (hasIncrement) {
      const monthsBefore = wefMonth - 1
      const monthsAfter = 13 - wefMonth
      // Pro-rated salary income + PF taxable portion pro-rated
      const salaryBefore = gross * 11.2 * (monthsBefore / 12)
      const salaryAfter = (gross + increment) * 11.2 * (monthsAfter / 12)
      // Pro-rated PF taxable amount
      let tp = 0
      if (hasProvidentFund) {
        const annualPFBefore = pf * monthsBefore
        const annualPFAfter = pfNew * monthsAfter
        const totalAnnualPF = annualPFBefore + annualPFAfter
        tp = totalAnnualPF > 150000 ? totalAnnualPF - 150000 : 0
      }
      annualIncomeAfter = salaryBefore + salaryAfter + additionalIncome + tp
    } else {
      annualIncomeAfter = annualIncomeBefore
    }

    const baseTax2025_26 = calculateTax(annualIncomeAfter, TAX_SLABS_2025_26)
    const superTax2025_26 = annualIncomeAfter > SUPER_TAX_THRESHOLD ? Math.round(baseTax2025_26 * SUPER_TAX_RATE) : 0
    const tax2025_26 = baseTax2025_26 + superTax2025_26
    const tax2026_27 = calculateTax(annualIncomeAfter, TAX_SLABS_2026_27)
    const difference = tax2026_27 - tax2025_26
    const monthlyTax2025_26 = tax2025_26 / 12
    const monthlyTax2026_27 = tax2026_27 / 12
    const monthlyDifference = difference / 12

    // Monthly take home: show current (before increment) value when increment exists
    const monthlyTakeHome = hasIncrement
      ? takeHomeBefore
      : gross - pf - monthlyTax2026_27 - FIXED_EOBI

    const breakdown2025_26 = getSlabBreakdown(annualIncomeAfter, TAX_SLABS_2025_26)
    const breakdown2026_27 = getSlabBreakdown(annualIncomeAfter, TAX_SLABS_2026_27)

    const effectiveRate2025_26 = getEffectiveRate(tax2025_26, annualIncomeAfter)
    const effectiveRate2026_27 = getEffectiveRate(tax2026_27, annualIncomeAfter)

    // Increment impact data
    const incrementImpact = hasIncrement ? (() => {
      const postWefTax = (tax2026_27 - (wefMonth - 1) * (taxBefore2627 / 12)) / (13 - wefMonth)
      const thAfter = (gross + increment) - (hasProvidentFund ? pfNew : 0) - postWefTax - FIXED_EOBI
      return {
        taxIncrease2627: taxBefore2627 > 0 ? ((tax2026_27 - taxBefore2627) / taxBefore2627 * 100) : 0,
        monthlyTaxDiff: (tax2026_27 - taxBefore2627) / 12,
        pfBefore: pf,
        pfAfter: pfNew,
        pfIncrease: pfNew - pf,
        grossBefore: gross,
        grossAfter: gross + increment,
        takeHomeBefore,
        postWefMonthlyTax: postWefTax,
        takeHomeAfter: thAfter,
        takeHomeDiff: thAfter - takeHomeBefore,
        annualIncomeBefore,
        annualIncomeAfter,
        wefMonthName: FY_MONTHS[wefMonth - 1],
      }
    })() : null

    // Monthly schedule data (increment-aware)
    const scheduleData = FY_MONTHS.map((month, i) => {
      const monthIndex = i + 1
      const isAfterWef = hasIncrement && monthIndex >= wefMonth
      const isWefMonth = hasIncrement && monthIndex === wefMonth
      const mGross = isAfterWef ? gross + increment : gross
      const mPF = hasProvidentFund ? (isAfterWef ? pfNew : pf) : 0
      let mTax2627: number
      if (hasIncrement) {
        if (!isAfterWef) {
          mTax2627 = taxBefore2627 / 12
        } else {
          const preWefTotal = (wefMonth - 1) * (taxBefore2627 / 12)
          const remaining = tax2026_27 - preWefTotal
          mTax2627 = remaining / (13 - wefMonth)
        }
      } else {
        mTax2627 = tax2026_27 / 12
      }
      const mTakeHome = mGross - mPF - mTax2627 - FIXED_EOBI
      return {
        month, monthIndex, mGross, mPF, mTax2627, mTakeHome,
        mTax2526: tax2025_26 / 12,
        isAfterWef, isWefMonth,
      }
    })

    return {
      annualIncome: annualIncomeAfter,
      annualIncomeBefore: hasIncrement ? annualIncomeBefore : null,
      baseTax2025_26,
      tax2025_26,
      superTax2025_26,
      tax2026_27,
      taxBefore2627: hasIncrement ? taxBefore2627 : null,
      difference,
      monthlyTax2025_26,
      monthlyTax2026_27,
      monthlyDifference,
      breakdown2025_26,
      breakdown2026_27,
      effectiveRate2025_26,
      effectiveRate2026_27,
      monthlyPF: hasProvidentFund ? pf : 0,
      monthlyEOBI: FIXED_EOBI,
      monthlyTakeHome,
      incrementImpact,
      scheduleData,
    }
  }, [monthlyGross, additionalIncome, taxablePF, taxablePFNew, pfData, pfDataNew, increment, wefMonth, hasProvidentFund])

  const comparisonChartData = useMemo(() => {
    if (!results) return []
    return [
      {
        name: 'FY 2025-26',
        tax: Math.round(results.tax2025_26),
        fill: '#64748b',
      },
      {
        name: 'FY 2026-27',
        tax: Math.round(results.tax2026_27),
        fill: results.difference <= 0 ? '#16a34a' : '#dc2626',
      },
    ]
  }, [results])

  const monthlyChartData = useMemo(() => {
    if (!results) return []
    return [
      {
        name: 'FY 2025-26',
        tax: Math.round(results.monthlyTax2025_26),
        fill: '#94a3b8',
      },
      {
        name: 'FY 2026-27',
        tax: Math.round(results.monthlyTax2026_27),
        fill: results.monthlyDifference <= 0 ? '#4ade80' : '#f87171',
      },
    ]
  }, [results])

  const handleCalculate = useCallback(() => {
    if (parseNum(monthlyGross) > 0) {
      setShowResults(true)
    }
  }, [monthlyGross])

  const handleReset = useCallback(() => {
    setMonthlyGross('')
    setBonus('')
    setSpecialAllowance('')
    setArrears('')
    setAnnualIncrement('')
    setIncrementWef('')
    setOtherIncome('')
    setHasProvidentFund(false)
    setShowResults(false)
    setShowBreakdown(false)
    setShowSchedule(false)
  }, [])

  const toggleSlab = (year: string) => {
    setExpandedSlabs((prev) => ({ ...prev, [year]: !prev[year] }))
  }

  const totalAdditional = parseNum(bonus) + parseNum(specialAllowance) + parseNum(arrears) + parseNum(otherIncome)

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-emerald-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">Pakistan Tax Calculator</h1>
                  <p className="text-xs text-slate-500">Federal Board of Revenue</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-xs hidden sm:flex">
                  FY 2026-27
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Updated July 2026
                </Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* ─── Hero Section ─── */}
          <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-300 rounded-full blur-3xl" />
            </div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center max-w-3xl mx-auto"
              >
                <Badge className="bg-white/15 text-white border-white/20 mb-4 text-sm px-4 py-1">
                  <Scale className="w-3.5 h-3.5 mr-1.5" />
                  Government of Pakistan
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
                  Income Tax Calculator
                </h1>
                <p className="text-lg sm:text-xl text-emerald-100 max-w-2xl mx-auto leading-relaxed">
                  Calculate your salary tax for <span className="font-semibold text-white">FY 2026-27</span> and compare with
                  <span className="font-semibold text-white"> FY 2025-26</span> to see your savings instantly.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mt-8 text-sm">
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Salaried Individuals</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Year-over-Year Comparison</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Detailed Slab Breakdown</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            {/* ─── Calculator & Results Grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
              {/* ─── Left: Calculator Input ─── */}
              <motion.div
                {...fadeInUp}
                className="lg:col-span-2"
              >
                <Card className="border-slate-200 shadow-lg shadow-slate-200/50">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Calculator className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Tax Calculator</CardTitle>
                        <CardDescription className="text-xs">Enter your salary details below</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Monthly Gross Salary */}
                    <div className="space-y-2">
                      <Label htmlFor="monthlyGross" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        Monthly Gross Salary
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="monthlyGross"
                        type="number"
                        placeholder="e.g. 100,000"
                        value={monthlyGross}
                        onChange={(e) => setMonthlyGross(e.target.value)}
                        className="pl-3 h-11 text-base font-medium border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      />
                    </div>

                    <Separator className="my-2" />

                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 font-medium">Additional Annual Income (Optional)</span>
                    </div>

                    {/* Additional Income Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="bonus" className="text-xs text-slate-500">Bonus</Label>
                        <div className="relative">
                          <Input
                            id="bonus"
                            type="number"
                            placeholder="0"
                            value={bonus}
                            onChange={(e) => setBonus(e.target.value)}
                            className="pl-3 h-9 text-sm border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="specialAllowance" className="text-xs text-slate-500">Special Allowance</Label>
                        <div className="relative">
                          <Input
                            id="specialAllowance"
                            type="number"
                            placeholder="0"
                            value={specialAllowance}
                            onChange={(e) => setSpecialAllowance(e.target.value)}
                            className="pl-3 h-9 text-sm border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="arrears" className="text-xs text-slate-500">Arrears</Label>
                        <div className="relative">
                          <Input
                            id="arrears"
                            type="number"
                            placeholder="0"
                            value={arrears}
                            onChange={(e) => setArrears(e.target.value)}
                            className="pl-3 h-9 text-sm border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor="annualIncrement" className="text-xs text-slate-500 flex items-center gap-1.5">
                          Monthly Increment
                          {parseNum(annualIncrement) > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3 h-3 text-slate-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[240px]">
                                Enter the monthly salary increase amount and select the month it takes effect from. Tax &amp; PF will be recalculated pro-rata.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="annualIncrement"
                              type="number"
                              placeholder="e.g. 5,000"
                              value={annualIncrement}
                              onChange={(e) => setAnnualIncrement(e.target.value)}
                              className="pl-3 h-9 text-sm border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                            />
                          </div>
                          {parseNum(annualIncrement) > 0 && (
                            <motion.div
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              className="relative"
                            >
                              <select
                                value={incrementWef}
                                onChange={(e) => setIncrementWef(e.target.value)}
                                className="h-9 text-xs border border-slate-200 rounded-md px-2 bg-white text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20 appearance-none cursor-pointer pr-6"
                              >
                                <option value="">w.e.f</option>
                                {FY_MONTHS.map((m, i) => (
                                  <option key={i} value={String(i + 1)}>{m}</option>
                                ))}
                              </select>
                            </motion.div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="otherIncome" className="text-xs text-slate-500">Other Income</Label>
                        <div className="relative">
                          <Input
                            id="otherIncome"
                            type="number"
                            placeholder="0"
                            value={otherIncome}
                            onChange={(e) => setOtherIncome(e.target.value)}
                            className="pl-3 h-9 text-sm border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                    </div>

                    {totalAdditional > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-emerald-50 rounded-lg px-3 py-2 flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-emerald-700">Total Additional Income</span>
                        <span className="text-sm font-bold text-emerald-800">{formatPKR(totalAdditional)}</span>
                      </motion.div>
                    )}

                    {/* Provident Fund Toggle */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-lg p-3.5 border border-amber-200/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-2.5">
                          <Landmark className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800">Taxable Provident Fund</p>
                            <p className="text-[10px] text-amber-600/80 mt-0.5 leading-relaxed">
                              Employer&apos;s contribution to PF (exempt up to 150,000/year)
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={hasProvidentFund}
                          onCheckedChange={setHasProvidentFund}
                          className="data-[state=checked]:bg-amber-500"
                        />
                      </div>
                      {hasProvidentFund && pfData && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t border-amber-200/50 space-y-1.5"
                        >
                          <div className="flex justify-between text-[11px]">
                            <span className="text-amber-700">Monthly PF (Gross &times; 66.67% &times; 8.33%)</span>
                            <span className="font-semibold text-amber-800">{formatPKR(pfData.monthlyPF)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-amber-700">Annual PF</span>
                            <span className="font-semibold text-amber-800">{formatPKR(pfData.annualPF)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-amber-700">Exempt Amount</span>
                            <span className="font-medium text-green-600">- {formatPKR(pfData.exemptAmount)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] bg-amber-100/60 rounded px-2 py-1.5 -mx-2">
                            <span className="font-semibold text-amber-900">Taxable PF</span>
                            <span className="font-bold text-amber-900">{formatPKR(pfData.taxablePF)}</span>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Formula Note */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-500 leading-relaxed">
                          <span className="font-semibold text-slate-600">Formula:</span> Annual Taxable Income = (Monthly Gross &times; 11.2) + Additional Income
                          {hasProvidentFund && pfData && pfData.taxablePF > 0 ? ` + Taxable PF (${formatPKR(pfData.taxablePF)})` : ''}
                          {results?.incrementImpact ? (
                            <span className="block mt-1 text-blue-600">
                              <TrendingUp className="w-3 h-3 inline mr-0.5" />
                              <span className="font-semibold">Increment:</span> Pro-rated w.e.f {results.incrementImpact.wefMonthName} — {formatPKR(results.annualIncomeBefore!)} → {formatPKR(results.annualIncome)}
                            </span>
                          ) : results?.annualIncome && results.annualIncome > SUPER_TAX_THRESHOLD ? (
                            <span className="block mt-1 text-amber-600">
                              <ShieldCheck className="w-3 h-3 inline mr-0.5" />
                              <span className="font-semibold">Super Tax:</span> FY 2024-25 applies 10%, FY 2025-26 applies 9% surcharge on income above 10M
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={handleCalculate}
                        className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-600/25 transition-all duration-200"
                      >
                        <Calculator className="w-4 h-4 mr-2" />
                        Calculate Tax
                      </Button>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="h-11 border-slate-200 hover:bg-slate-50"
                      >
                        <RefreshCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ─── Right: Results ─── */}
              <motion.div
                {...fadeInUp}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="lg:col-span-3 space-y-6"
              >
                <AnimatePresence mode="wait">
                  {!showResults || !results ? (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-16 lg:py-24 text-center"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
                        <Receipt className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-400 mb-2">No Results Yet</h3>
                      <p className="text-sm text-slate-400 max-w-sm">
                        Enter your monthly gross salary and click &ldquo;Calculate Tax&rdquo; to see your tax comparison.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Monthly Take Home Card */}
                      <Card className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/30 shadow-lg">
                        <CardContent className="pt-5 pb-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <CardTitle className="text-base text-emerald-900">Monthly Take Home</CardTitle>
                                <CardDescription className="text-[10px] text-emerald-600">After all deductions (FY 2026-27)</CardDescription>
                              </div>
                            </div>
                            <span className="text-xs text-emerald-500 font-medium">
                              {((results.monthlyTakeHome / parseNum(monthlyGross)) * 100).toFixed(1)}% of gross
                            </span>
                          </div>

                          {/* Deduction breakdown */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Monthly Gross Salary
                              </span>
                              <span className="text-sm font-semibold text-slate-800">{formatPKR(parseNum(monthlyGross))}</span>
                            </div>

                            {results.monthlyPF > 0 && (
                              <div className="flex items-center justify-between pl-3.5">
                                <span className="text-xs text-red-500 flex items-center gap-1.5">
                                  <Minus className="w-3 h-3" />
                                  Monthly Provident Fund
                                </span>
                                <span className="text-sm font-medium text-red-500">- {formatPKR(results.monthlyPF)}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between pl-3.5">
                              <span className="text-xs text-red-500 flex items-center gap-1.5">
                                <Minus className="w-3 h-3" />
                                Monthly Income Tax
                              </span>
                              <span className="text-sm font-medium text-red-500">- {formatPKR(results.incrementImpact ? results.taxBefore2627! / 12 : results.monthlyTax2026_27)}</span>
                            </div>

                            {results.monthlyEOBI > 0 && (
                              <div className="flex items-center justify-between pl-3.5">
                                <span className="text-xs text-red-500 flex items-center gap-1.5">
                                  <Minus className="w-3 h-3" />
                                  Monthly EOBI
                                </span>
                                <span className="text-sm font-medium text-red-500">- {formatPKR(results.monthlyEOBI)}</span>
                              </div>
                            )}

                            <Separator className="bg-emerald-200" />

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                                <HomeIcon className="w-4 h-4" />
                                Net Take Home
                              </span>
                              <span className="text-xl font-extrabold text-emerald-700">{formatPKR(results.monthlyTakeHome)}</span>
                            </div>
                          </div>

                          {/* Visual bar */}
                          <div className="mt-4">
                            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                              <div
                                className="bg-emerald-500 transition-all duration-700"
                                style={{ width: `${Math.max(0, (results.monthlyTakeHome / parseNum(monthlyGross)) * 100)}%` }}
                                title={`Take Home: ${formatPKR(results.monthlyTakeHome)}`}
                              />
                              {results.monthlyPF > 0 && (
                                <div
                                  className="bg-amber-400 transition-all duration-700"
                                  style={{ width: `${(results.monthlyPF / parseNum(monthlyGross)) * 100}%` }}
                                  title={`PF: ${formatPKR(results.monthlyPF)}`}
                                />
                              )}
                              <div
                                className="bg-red-400 transition-all duration-700"
                                style={{ width: `${((results.incrementImpact ? results.taxBefore2627! / 12 : results.monthlyTax2026_27) / parseNum(monthlyGross)) * 100}%` }}
                                title={`Tax: ${formatPKR(results.incrementImpact ? results.taxBefore2627! / 12 : results.monthlyTax2026_27)}`}
                              />
                              {results.monthlyEOBI > 0 && (
                                <div
                                  className="bg-purple-400 transition-all duration-700"
                                  style={{ width: `${(results.monthlyEOBI / parseNum(monthlyGross)) * 100}%` }}
                                  title={`EOBI: ${formatPKR(results.monthlyEOBI)}`}
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Take Home
                              </div>
                              {results.monthlyPF > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span className="w-2 h-2 rounded-sm bg-amber-400" /> PF
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="w-2 h-2 rounded-sm bg-red-400" /> Tax
                              </div>
                              {results.monthlyEOBI > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span className="w-2 h-2 rounded-sm bg-purple-400" /> EOBI
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Annual Taxable Income Card */}
                      <Card className="border-slate-200 bg-gradient-to-r from-slate-50 to-white shadow-md">
                        <CardContent className="pt-5 pb-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                                Annual Taxable Income
                              </p>
                              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                {formatPKR(results.annualIncome)}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {results.annualIncomeBefore ? (
                                  <><span>Pro-rated from {FY_MONTHS[wefMonth - 1]}: {formatPKR(parseNum(monthlyGross))} &times; {((wefMonth-1)/12*11.2).toFixed(1)}mo + {formatPKR(parseNum(monthlyGross) + increment)} &times; {((13-wefMonth)/12*11.2).toFixed(1)}mo</span>
                                    {totalAdditional > 0 && <span>{` + ${formatPKR(totalAdditional)}`}</span>}
                                    {taxablePF > 0 && <span>{` + ${formatPKR(taxablePF)} PF`}</span>}
                                  </>
                                ) : (
                                  <><span>{formatPKR(parseNum(monthlyGross))} /month &times; 11.2</span>
                                    {totalAdditional > 0 && <span>{` + ${formatPKR(totalAdditional)} additional`}</span>}
                                    {taxablePF > 0 && <span>{` + ${formatPKR(taxablePF)} taxable PF`}</span>}
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                              <Landmark className="w-7 h-7 text-emerald-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tax Comparison Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* FY 2025-26 */}
                        <Card className={`shadow-md ${results.superTax2025_26 > 0 ? 'border-amber-300 bg-gradient-to-br from-amber-50/50 to-white' : 'border-slate-200'}`}>
                          <CardContent className="pt-5 pb-5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className={`border-slate-200 text-slate-600 ${results.superTax2025_26 > 0 ? 'border-amber-300 text-amber-700' : ''}`}>FY 2025-26</Badge>
                                {results.superTax2025_26 > 0 && (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0">
                                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />+9% Super Tax
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {results.effectiveRate2025_26.toFixed(1)}% eff.
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-1">Annual Tax</p>
                            <p className="text-xl font-bold text-slate-800">
                              {formatPKR(results.tax2025_26)}
                            </p>
                            {results.superTax2025_26 > 0 && (
                              <div className="mt-2 space-y-1 bg-amber-50 rounded-md px-2.5 py-2 border border-amber-100">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-slate-500">Base Income Tax</span>
                                  <span className="font-medium text-slate-700">{formatPKR(results.baseTax2025_26)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-amber-700">Super Tax (9% on base tax)</span>
                                  <span className="font-bold text-amber-700">+ {formatPKR(results.superTax2025_26)}</span>
                                </div>
                              </div>
                            )}
                            <Separator className="my-3" />
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-500">Monthly Tax</span>
                              <span className="text-sm font-semibold text-slate-700">
                                {formatPKR(results.monthlyTax2025_26)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* FY 2026-27 */}
                        <Card className="border-emerald-200 shadow-md bg-gradient-to-br from-emerald-50 to-white">
                          <CardContent className="pt-5 pb-5">
                            <div className="flex items-center justify-between mb-3">
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                FY 2026-27
                              </Badge>
                              <span className="text-xs text-emerald-600 font-medium">
                                {results.effectiveRate2026_27.toFixed(1)}% eff.
                              </span>
                            </div>
                            <p className="text-xs text-emerald-600 mb-1">Annual Tax</p>
                            <p className="text-xl font-bold text-emerald-800">
                              {formatPKR(results.tax2026_27)}
                            </p>
                            <Separator className="my-3 bg-emerald-100" />
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-emerald-600">Monthly Tax</span>
                              <span className="text-sm font-semibold text-emerald-700">
                                {formatPKR(results.monthlyTax2026_27)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Savings/Difference Card */}
                      <Card className={`border-2 shadow-lg ${results.difference <= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                        <CardContent className="pt-5 pb-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${results.difference <= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                {results.difference <= 0 ? (
                                  <PiggyBank className="w-6 h-6 text-green-600" />
                                ) : (
                                  <AlertCircle className="w-6 h-6 text-red-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  {results.difference <= 0 ? 'You Save' : 'Additional Tax'}
                                </p>
                                <p className={`text-2xl font-extrabold ${results.difference <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {formatPKR(Math.abs(results.difference))}
                                  <span className="text-sm font-medium ml-1">/ year</span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                results.difference <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {results.difference <= 0 ? (
                                  <>
                                    <TrendingDown className="w-4 h-4" />
                                    {formatPKR(Math.abs(results.monthlyDifference))}/mo
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="w-4 h-4" />
                                    +{formatPKR(Math.abs(results.monthlyDifference))}/mo
                                  </>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                {results.difference === 0
                                  ? 'No change'
                                  : `${((Math.abs(results.difference) / results.tax2025_26) * 100).toFixed(1)}% ${results.difference <= 0 ? 'reduction' : 'increase'}`
                                }
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Increment Impact Card */}
                      {results.incrementImpact && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 }}
                        >
                          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/40 shadow-md">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-sm text-blue-900">Increment Impact</CardTitle>
                                    <CardDescription className="text-[10px] text-blue-500">
                                      w.e.f {results.incrementImpact.wefMonthName} — Monthly +{formatPKR(results.incrementImpact.grossAfter - results.incrementImpact.grossBefore)}
                                    </CardDescription>
                                  </div>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                  FY 2026-27
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="grid grid-cols-2 gap-3">
                                {/* Before Increment */}
                                <div className="bg-white rounded-lg p-3 border border-slate-100 space-y-2">
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Before Increment</p>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-slate-500">Monthly Gross</span>
                                      <span className="font-semibold text-slate-700">{formatPKR(results.incrementImpact.grossBefore)}</span>
                                    </div>
                                    {hasProvidentFund && (
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-500">Monthly PF</span>
                                        <span className="font-medium text-slate-600">{formatPKR(results.incrementImpact.pfBefore)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-slate-500">Monthly Tax</span>
                                      <span className="font-medium text-slate-600">{formatPKR(results.taxBefore2627 ? results.taxBefore2627 / 12 : 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-slate-500">Monthly EOBI</span>
                                      <span className="font-medium text-slate-600">{formatPKR(FIXED_EOBI)}</span>
                                    </div>
                                    <Separator className="!my-1.5" />
                                    <div className="flex justify-between text-xs">
                                      <span className="font-semibold text-slate-600">Take Home</span>
                                      <span className="font-bold text-slate-800">{formatPKR(results.incrementImpact.takeHomeBefore)}</span>
                                    </div>
                                  </div>
                                </div>
                                {/* After Increment */}
                                <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 space-y-2">
                                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">After Increment</p>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-blue-600">Monthly Gross</span>
                                      <span className="font-semibold text-blue-800">{formatPKR(results.incrementImpact.grossAfter)}</span>
                                    </div>
                                    {hasProvidentFund && (
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-blue-600">Monthly PF</span>
                                        <span className="font-medium text-blue-700">{formatPKR(results.incrementImpact.pfAfter)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-blue-600">Monthly Tax</span>
                                      <span className="font-medium text-blue-700">{formatPKR(results.incrementImpact.postWefMonthlyTax)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-blue-600">Monthly EOBI</span>
                                      <span className="font-medium text-blue-700">{formatPKR(FIXED_EOBI)}</span>
                                    </div>
                                    <Separator className="!my-1.5 bg-blue-200" />
                                    <div className="flex justify-between text-xs">
                                      <span className="font-semibold text-blue-700">Take Home</span>
                                      <span className="font-bold text-blue-900">{formatPKR(results.incrementImpact.takeHomeAfter)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {/* Delta row */}
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="text-center bg-white rounded-md px-2 py-2 border border-slate-100">
                                  <p className="text-[9px] text-slate-400 uppercase">Tax Change/mo</p>
                                  <p className={`text-xs font-bold ${results.incrementImpact.monthlyTaxDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {results.incrementImpact.monthlyTaxDiff > 0 ? '+' : ''}{formatPKR(results.incrementImpact.monthlyTaxDiff)}
                                  </p>
                                </div>
                                {hasProvidentFund && (
                                  <div className="text-center bg-white rounded-md px-2 py-2 border border-slate-100">
                                    <p className="text-[9px] text-slate-400 uppercase">PF Change/mo</p>
                                    <p className="text-xs font-bold text-amber-600">
                                      +{formatPKR(results.incrementImpact.pfIncrease)}
                                    </p>
                                  </div>
                                )}
                                <div className={`text-center rounded-md px-2 py-2 border ${results.incrementImpact.takeHomeDiff >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <p className="text-[9px] text-slate-400 uppercase">Net Change/mo</p>
                                  <p className={`text-xs font-bold ${results.incrementImpact.takeHomeDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {results.incrementImpact.takeHomeDiff >= 0 ? '+' : ''}{formatPKR(results.incrementImpact.takeHomeDiff)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}

                      {/* Comparison Chart */}
                      <Card className="border-slate-200 shadow-md">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-emerald-600" />
                              <CardTitle className="text-base">Tax Comparison</CardTitle>
                            </div>
                            <Tabs defaultValue="annual" className="w-auto">
                              <TabsList className="h-8 p-0.5 bg-slate-100">
                                <TabsTrigger value="annual" className="text-xs px-3 h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">Annual</TabsTrigger>
                                <TabsTrigger value="monthly" className="text-xs px-3 h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">Monthly</TabsTrigger>
                              </TabsList>
                              <TabsContent value="annual" className="mt-0">
                                <div className="h-48">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparisonChartData} barSize={60} layout="vertical">
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                      <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} fontSize={11} stroke="#94a3b8" />
                                      <YAxis type="category" dataKey="name" width={90} fontSize={12} fontWeight={600} stroke="#64748b" />
                                      <Bar dataKey="tax" radius={[0, 6, 6, 0]} name="Tax Amount">
                                        {comparisonChartData.map((entry, index) => (
                                          <Cell key={index} fill={entry.fill} />
                                        ))}
                                      </Bar>
                                      <Tooltip
                                        formatter={(value: number) => [formatPKR(value), 'Tax']}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </TabsContent>
                              <TabsContent value="monthly" className="mt-0">
                                <div className="h-48">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyChartData} barSize={60} layout="vertical">
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                      <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} fontSize={11} stroke="#94a3b8" />
                                      <YAxis type="category" dataKey="name" width={90} fontSize={12} fontWeight={600} stroke="#64748b" />
                                      <Bar dataKey="tax" radius={[0, 6, 6, 0]} name="Monthly Tax">
                                        {monthlyChartData.map((entry, index) => (
                                          <Cell key={index} fill={entry.fill} />
                                        ))}
                                      </Bar>
                                      <Tooltip
                                        formatter={(value: number) => [formatPKR(value), 'Monthly Tax']}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {/* Effective Rate Comparison Bar */}
                          <div className="space-y-3 mt-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Effective Tax Rate 2025-26</span>
                              <span className="font-bold text-slate-700">{results.effectiveRate2025_26.toFixed(2)}%</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-slate-400 rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(results.effectiveRate2025_26 * 3, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-emerald-600 font-medium">Effective Tax Rate 2026-27</span>
                              <span className="font-bold text-emerald-700">{results.effectiveRate2026_27.toFixed(2)}%</span>
                            </div>
                            <div className="h-2.5 bg-emerald-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(results.effectiveRate2026_27 * 3, 100)}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Monthly Deduction Schedule Toggle */}
                      <Button
                        variant="outline"
                        onClick={() => setShowSchedule(!showSchedule)}
                        className="w-full border-emerald-200 hover:bg-emerald-50 text-emerald-700 bg-emerald-50/50"
                      >
                        <CalendarDays className="w-4 h-4 mr-2" />
                        {showSchedule ? 'Hide' : 'Show'} Monthly Deduction Schedule
                      </Button>

                      <AnimatePresence>
                        {showSchedule && results && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <Card className="border-emerald-200 shadow-md">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-emerald-600" />
                                    <CardTitle className="text-sm text-emerald-800">Monthly Deduction Schedule</CardTitle>
                                  </div>
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                    Jul 2026 – Jun 2027
                                  </Badge>
                                </div>
                                <CardDescription className="text-xs text-slate-500 mt-1">
                                  Month-by-month tax deduction with cumulative tracking
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="overflow-x-auto -mx-6 px-6">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-emerald-50/80 hover:bg-emerald-50/80">
                                        <TableHead className="text-[11px] font-bold text-emerald-800 w-10">#</TableHead>
                                        <TableHead className="text-[11px] font-bold text-emerald-800">Month</TableHead>
                                        <TableHead className="text-[11px] font-bold text-emerald-800 text-right">Gross Salary</TableHead>
                                        {hasProvidentFund && (
                                          <TableHead className="text-[11px] font-bold text-amber-600 text-right">PF</TableHead>
                                        )}
                                        <TableHead className="text-[11px] font-bold text-slate-600 text-right">Tax FY 25-26</TableHead>
                                        <TableHead className="text-[11px] font-bold text-emerald-700 text-right">Tax FY 26-27</TableHead>
                                        <TableHead className="text-[11px] font-bold text-right">Saving</TableHead>
                                        <TableHead className="text-[11px] font-bold text-slate-500 text-right">Cumul. 25-26</TableHead>
                                        <TableHead className="text-[11px] font-bold text-slate-500 text-right">Cumul. 26-27</TableHead>
                                        <TableHead className="text-[11px] font-bold text-emerald-700 text-right">Take Home</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(() => {
                                        let cumul2526 = 0
                                        let cumul2627 = 0
                                        return results.scheduleData.map((row, i) => {
                                          cumul2526 += row.mTax2526
                                          cumul2627 += row.mTax2627
                                          const saving = row.mTax2526 - row.mTax2627
                                          return (
                                            <TableRow
                                              key={i}
                                              className={`
                                                ${row.isWefMonth ? 'bg-blue-50 border-l-2 border-l-blue-400' : row.isAfterWef ? 'bg-blue-50/20 border-l-2 border-l-blue-200' : 'border-emerald-50'}
                                                hover:bg-emerald-50/30
                                              `}
                                            >
                                              <TableCell className="text-[11px] py-2.5 text-slate-500 font-medium">{row.monthIndex}</TableCell>
                                              <TableCell className="text-[11px] py-2.5 font-semibold text-slate-800">
                                                {row.month}
                                                {row.isWefMonth && (
                                                  <Badge className="ml-1.5 bg-blue-100 text-blue-700 border-blue-200 text-[8px] px-1.5 py-0 leading-tight">
                                                    +{formatPKR(increment)}
                                                  </Badge>
                                                )}
                                              </TableCell>
                                              <TableCell className={`text-[11px] py-2.5 text-right font-medium ${row.isAfterWef ? 'text-blue-700' : 'text-slate-600'}`}>
                                                {row.isAfterWef && !row.isWefMonth ? (
                                                  <span className="text-blue-400 mr-1">+</span>
                                                ) : null}
                                                {formatPKR(row.mGross)}
                                              </TableCell>
                                              {hasProvidentFund && (
                                                <TableCell className="text-[11px] py-2.5 text-right text-amber-600">{formatPKR(row.mPF)}</TableCell>
                                              )}
                                              <TableCell className="text-[11px] py-2.5 text-right text-slate-600">{formatPKR(row.mTax2526)}</TableCell>
                                              <TableCell className={`text-[11px] py-2.5 text-right font-semibold ${row.isAfterWef ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                {formatPKR(row.mTax2627)}
                                              </TableCell>
                                              <TableCell className={`text-[11px] py-2.5 text-right font-semibold ${saving > 0 ? 'text-green-600' : saving < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                {saving > 0 ? '' : saving < 0 ? '+' : ''}{formatPKR(saving)}
                                              </TableCell>
                                              <TableCell className="text-[11px] py-2.5 text-right text-slate-400">{formatPKR(cumul2526)}</TableCell>
                                              <TableCell className="text-[11px] py-2.5 text-right text-slate-400">{formatPKR(cumul2627)}</TableCell>
                                              <TableCell className={`text-[11px] py-2.5 text-right font-bold ${row.isAfterWef ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                {formatPKR(row.mTakeHome)}
                                              </TableCell>
                                            </TableRow>
                                          )
                                        })
                                      })()}
                                    </TableBody>
                                  </Table>
                                </div>
                                {/* Totals Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-emerald-100">
                                  <div className="text-center">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Deducted 25-26</p>
                                    <p className="text-sm font-bold text-slate-700">{formatPKR(results.tax2025_26)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Total Deducted 26-27</p>
                                    <p className="text-sm font-bold text-emerald-700">{formatPKR(results.tax2026_27)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Yearly Saving</p>
                                    <p className={`text-sm font-bold ${results.difference <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {results.difference <= 0 ? '' : '+'}{formatPKR(results.difference)}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Monthly Saving</p>
                                    <p className={`text-sm font-bold ${results.monthlyDifference <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {results.monthlyDifference <= 0 ? '' : '+'}{formatPKR(results.monthlyDifference)}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Slab Breakdown Toggle */}
                      <Button
                        variant="outline"
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        className="w-full border-slate-200 hover:bg-slate-50 text-slate-600"
                      >
                        {showBreakdown ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                        {showBreakdown ? 'Hide' : 'Show'} Detailed Slab Breakdown
                      </Button>

                      <AnimatePresence>
                        {showBreakdown && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* FY 2025-26 Breakdown */}
                              <Card className="border-slate-200">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm text-slate-600">FY 2025-26 Breakdown</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-slate-100">
                                        <TableHead className="text-xs">Slab Range</TableHead>
                                        <TableHead className="text-xs text-right">Rate</TableHead>
                                        <TableHead className="text-xs text-right">Tax</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {results.breakdown2025_26.map((item, i) => (
                                        <TableRow key={i} className="border-slate-50">
                                          <TableCell className="text-xs py-2 text-slate-600">{item.slab}</TableCell>
                                          <TableCell className="text-xs py-2 text-right font-medium">{(item.rate * 100).toFixed(0)}%</TableCell>
                                          <TableCell className="text-xs py-2 text-right font-semibold">{formatPKR(item.tax)}</TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow className="border-t-2 border-slate-200">
                                        <TableCell className="text-xs py-2 font-bold">Total</TableCell>
                                        <TableCell />
                                        <TableCell className="text-xs py-2 text-right font-bold text-slate-900">{formatPKR(results.tax2025_26)}</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </CardContent>
                              </Card>

                              {/* FY 2026-27 Breakdown */}
                              <Card className="border-emerald-200">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm text-emerald-700">FY 2026-27 Breakdown</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-emerald-100">
                                        <TableHead className="text-xs">Slab Range</TableHead>
                                        <TableHead className="text-xs text-right">Rate</TableHead>
                                        <TableHead className="text-xs text-right">Tax</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {results.breakdown2026_27.map((item, i) => (
                                        <TableRow key={i} className="border-emerald-50">
                                          <TableCell className="text-xs py-2 text-emerald-700">{item.slab}</TableCell>
                                          <TableCell className="text-xs py-2 text-right font-medium text-emerald-600">{(item.rate * 100).toFixed(0)}%</TableCell>
                                          <TableCell className="text-xs py-2 text-right font-semibold text-emerald-800">{formatPKR(item.tax)}</TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow className="border-t-2 border-emerald-200">
                                        <TableCell className="text-xs py-2 font-bold text-emerald-900">Total</TableCell>
                                        <TableCell />
                                        <TableCell className="text-xs py-2 text-right font-bold text-emerald-900">{formatPKR(results.tax2026_27)}</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </CardContent>
                              </Card>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* ─── Tax Slab Reference Tables ─── */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-12 sm:mt-16"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Tax Slab Rates</h2>
                <p className="text-slate-500 text-sm">Official FBR tax slabs for salaried individuals</p>
              </div>

              <Tabs value={activeSlabYear} onValueChange={setActiveSlabYear} className="w-full">
                <TabsList className="mx-auto flex w-fit mb-6 bg-slate-100 p-1">
                  <TabsTrigger value="2024-25" className="text-xs sm:text-sm px-3 sm:px-5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    FY 2024-25
                  </TabsTrigger>
                  <TabsTrigger value="2025-26" className="text-xs sm:text-sm px-3 sm:px-5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    FY 2025-26
                  </TabsTrigger>
                  <TabsTrigger value="2026-27" className="text-xs sm:text-sm px-3 sm:px-5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:bg-white">
                    FY 2026-27
                  </TabsTrigger>
                </TabsList>

                {(['2024-25', '2025-26', '2026-27'] as const).map((year) => {
                  const slabs = year === '2024-25' ? TAX_SLABS_2024_25 : year === '2025-26' ? TAX_SLABS_2025_26 : TAX_SLABS_2026_27
                  const isCurrent = year === '2026-27'

                  return (
                    <TabsContent key={year} value={year}>
                      <Card className={`shadow-md overflow-hidden ${isCurrent ? 'border-emerald-200' : 'border-slate-200'}`}>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow className={isCurrent ? 'bg-emerald-50 hover:bg-emerald-50' : 'bg-slate-50 hover:bg-slate-50'}>
                                <TableHead className={`text-xs font-bold ${isCurrent ? 'text-emerald-800' : 'text-slate-700'}`}>
                                  S.No.
                                </TableHead>
                                <TableHead className={`text-xs font-bold ${isCurrent ? 'text-emerald-800' : 'text-slate-700'}`}>
                                  Taxable Income Range
                                </TableHead>
                                <TableHead className={`text-xs font-bold text-right ${isCurrent ? 'text-emerald-800' : 'text-slate-700'}`}>
                                  Fixed Tax
                                </TableHead>
                                <TableHead className={`text-xs font-bold text-right ${isCurrent ? 'text-emerald-800' : 'text-slate-700'}`}>
                                  Rate (%)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {slabs.map((slab, i) => {
                                const rangeText = slab.max
                                  ? slab.min === 0
                                    ? `Up to ${slab.max.toLocaleString()}`
                                    : `${slab.min.toLocaleString()} - ${slab.max.toLocaleString()}`
                                  : `Above ${slab.min.toLocaleString()}`

                                return (
                                  <TableRow
                                    key={i}
                                    className={`transition-colors ${isCurrent ? 'hover:bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                                  >
                                    <TableCell className={`text-xs font-medium ${isCurrent ? 'text-emerald-700' : 'text-slate-600'}`}>
                                      {i + 1}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <span className={isCurrent ? 'text-emerald-800' : 'text-slate-800'}>
                                        {rangeText}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-semibold">
                                      {slab.fixedTax > 0 ? slab.fixedTax.toLocaleString() : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-right">
                                      <Badge variant="outline" className={`text-xs font-bold ${isCurrent ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600 bg-slate-50'}`}>
                                        {(slab.rate * 100).toFixed(0)}%
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      {/* Super Tax Note */}
                      {(year === '2024-25' || year === '2025-26') && (
                        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200/60">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">
                              Super Tax: {year === '2024-25' ? '10%' : '9%'} on calculated annual tax if annual taxable income exceeds 10,000,000
                            </p>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  )
                })}
              </Tabs>
            </motion.section>

            {/* ─── Key Highlights Section ─── */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-12 sm:mt-16 mb-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Key Changes in FY 2026-27</h2>
                <p className="text-slate-500 text-sm">What&apos;s new compared to last year</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <motion.div {...fadeInUp}>
                  <Card className="border-slate-200 h-full hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-5">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                        <TrendingDown className="w-5 h-5 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-2">Lower Tax Rates</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Tax rates reduced in the 2.2M to 5.6M slab range. The 23% rate dropped to 20%, 30% to 25%, and 35% to 29% for middle-income brackets.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div {...fadeInUp} transition={{ delay: 0.1 }}>
                  <Card className="border-slate-200 h-full hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-5">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-2">New Slab Brackets</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Two new tax brackets added: 5.6M-7M at 32% and above 7M at 35%. This creates a more progressive structure for higher earners.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div {...fadeInUp} transition={{ delay: 0.2 }}>
                  <Card className="border-slate-200 h-full hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-5">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                        <PiggyBank className="w-5 h-5 text-amber-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-2">Maximum Savings</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Maximum annual savings of 207,000 for taxable income between 7M and above. Lower brackets also benefit with reduced monthly deductions.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.section>
          </div>
        </main>

        {/* ─── Footer ─── */}
        <footer className="mt-auto border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calculator className="w-4 h-4" />
                <span>Pakistan Tax Calculator FY 2026-27</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <p className="text-xs text-slate-400 text-center sm:text-right">
                  Based on FBR Income Tax Ordinance, 2001. For reference only &mdash; consult a tax professional for official filing.
                </p>
                <div className="flex items-center gap-2 sm:pl-4 sm:border-l border-slate-200">
                  <span className="text-xs text-slate-400">Powered by</span>
                  <img src="/logo.svg" alt="SplitTax Calculator" className="h-5 w-auto" />
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}
