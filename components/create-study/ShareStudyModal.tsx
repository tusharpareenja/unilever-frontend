"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { X, UserPlus, Shield, Eye, Trash2, Loader2, Mail } from "lucide-react"
import {
    getStudyMembers,
    inviteStudyMember,
    updateStudyMemberRole,
    removeStudyMember,
    StudyMember
} from "@/lib/api/StudyAPI"
import { useAuth } from "@/lib/auth/AuthContext"

interface ShareStudyModalProps {
    isOpen: boolean
    onClose: () => void
    studyId: string
    userRole?: string
}

export function ShareStudyModal({ isOpen, onClose, studyId, userRole = 'admin' }: ShareStudyModalProps) {
    const [email, setEmail] = useState("")
    const [role, setRole] = useState("viewer")
    const [members, setMembers] = useState<StudyMember[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { user: authUser } = useAuth()

    // Robust user detection: Hook > LocalStorage
    const currentUser = authUser || (() => {
        if (typeof window !== 'undefined') {
            try {
                const ls = localStorage.getItem('user');
                return ls ? JSON.parse(ls) : null;
            } catch (e) { return null; }
        }
        return null;
    })();

    useEffect(() => {
        if (studyId && (userRole === 'admin' || userRole === 'editor')) {
            fetchMembers()
        }
    }, [studyId, userRole])

    const fetchMembers = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await getStudyMembers(studyId)

            // Post-process to ensure Admin (current user) is present
            let finalMembers = [...data]
            if (userRole === 'admin') {
                // Try to get user from hook or LS
                let myEmail = currentUser?.email
                let myName = currentUser?.name

                if (!myEmail && typeof window !== 'undefined') {
                    try {
                        const lsUser = localStorage.getItem('user')
                        if (lsUser) {
                            const parsed = JSON.parse(lsUser)
                            myEmail = parsed.email
                            myName = parsed.name
                        }
                    } catch (e) { }
                }

                if (myEmail) {
                    const normalizedMyEmail = myEmail.trim().toLowerCase()
                    const exists = finalMembers.some(m =>
                        (m.email || m.invited_email || '').trim().toLowerCase() === normalizedMyEmail
                    )

                    if (!exists) {
                        finalMembers.push({
                            id: 'current-admin-injection',
                            email: myEmail,
                            name: myName || '',
                            role: 'admin',
                            status: 'active'
                        })
                    }
                }
            }

            setMembers(finalMembers)
        } catch (err: any) {
            console.error("Failed to fetch members:", err)
            setError("Failed to load members")
        } finally {
            setIsLoading(false)
        }
    }

    const handleInvite = async () => {
        if (!email) return

        const inviteEmail = email.trim()

        // Check for duplicate
        const exists = members.some(m =>
            (m.email || m.invited_email || '').toLowerCase() === inviteEmail.toLowerCase()
        )
        if (exists) {
            setError("User is already a member")
            return
        }

        const inviteRole = role

        // Optimistic update
        const tempId = `temp-${Date.now()}`
        const newMember: StudyMember = {
            id: tempId,
            email: inviteEmail,
            invited_email: inviteEmail,
            role: inviteRole as 'editor' | 'viewer',
            name: "", // Will be updated on next fetch
            status: 'pending'
        }

        const previousMembers = [...members]
        setMembers(prev => [newMember, ...prev])
        setEmail("")
        setError(null)

        try {
            await inviteStudyMember(studyId, inviteEmail, inviteRole)
            // Re-fetch to get real ID and confirmed data structure
            await fetchMembers()
        } catch (err: any) {
            console.error("Failed to invite member:", err)
            setError(err.message || "Failed to invite member")
            // Rollback on failure
            setMembers(previousMembers)
            setEmail(inviteEmail) // Restore email so user doesn't lose it
        }
    }

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        setIsActionLoading(true)
        try {
            await updateStudyMemberRole(studyId, memberId, newRole)
            await fetchMembers()
        } catch (err: any) {
            console.error("Failed to update role:", err)
            setError(err.message || "Failed to update role")
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        // Optimistic update: instantly remove from UI
        const previousMembers = [...members]
        setMembers(prev => prev.filter(m => m.id !== memberId))
        setError(null)

        try {
            await removeStudyMember(studyId, memberId)
            // No need to fetchMembers() here as we already removed it from local state
            // fetchMembers() // Optional: keep if we want to sync with server eventually
        } catch (err: any) {
            console.error("Failed to remove member:", err)
            setError(err.message || "Failed to remove member")
            // Rollback on failure
            setMembers(previousMembers)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                                <div className="flex items-center space-x-2">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <UserPlus className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800">Share Study</h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6 overflow-y-auto">
                                {/* Invite Form */}
                                <div className="space-y-4 bg-blue-50/30 p-4 rounded-lg border border-blue-100">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1">
                                            <Input
                                                type="email"
                                                placeholder="Enter email address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="bg-white"
                                            />
                                        </div>
                                        <div className="w-full sm:w-32">
                                            <Select value={role} onValueChange={setRole}>
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="editor">Editor</SelectItem>
                                                    <SelectItem value="viewer">Viewer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            onClick={handleInvite}
                                            disabled={!email || !email.includes("@") || isActionLoading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                                        >
                                            {isActionLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Invite"
                                            )}
                                        </Button>
                                    </div>
                                    {error && <p className="text-xs text-red-500">{error}</p>}
                                </div>

                                {/* Members List */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Members with access</span>
                                        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                                    </h4>

                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {[...members]
                                            .sort((a, b) => {
                                                const emailA = (a.email || a.invited_email || '').toLowerCase();
                                                const emailB = (b.email || b.invited_email || '').toLowerCase();
                                                const currentEmail = (currentUser?.email || '').toLowerCase();

                                                const isSelfA = currentUser && emailA === currentEmail;
                                                const isSelfB = currentUser && emailB === currentEmail;

                                                const roleA = (a.role || '').toLowerCase();
                                                const roleB = (b.role || '').toLowerCase();
                                                const isAdminA = roleA === 'admin' || roleA === 'owner';
                                                const isAdminB = roleB === 'admin' || roleB === 'owner';

                                                // Priority 1: Current User + Admin (force top per user request)
                                                // If I am the user, and I have admin privileges (either from list or from prop context)
                                                const isSelfAdminA = isSelfA && (isAdminA || userRole === 'admin');
                                                const isSelfAdminB = isSelfB && (isAdminB || userRole === 'admin');

                                                if (isSelfAdminA && !isSelfAdminB) return -1;
                                                if (!isSelfAdminA && isSelfAdminB) return 1;

                                                // Priority 2: Admin/Owner always first
                                                if (isAdminA && !isAdminB) return -1;
                                                if (!isAdminA && isAdminB) return 1;

                                                // Priority 3: Current user (non-admin)
                                                if (isSelfA && !isSelfB) return -1;
                                                if (!isSelfA && isSelfB) return 1;

                                                return 0
                                            })
                                            .map((member) => {
                                                const currentEmail = (currentUser?.email || '').toLowerCase();
                                                const memberEmail = (member.email || member.invited_email || '').toLowerCase();
                                                const isSelf = currentUser && memberEmail === currentEmail;

                                                // Determine "Admin" badge
                                                // Logic: If member is explicitly admin in list OR (it is self + userRole prop says admin)
                                                const rawRole = (member.role || '').toLowerCase();
                                                const isExplicitAdmin = rawRole === 'admin' || rawRole === 'owner';
                                                const isSelfAndStudyAdmin = isSelf && (userRole === 'admin');
                                                const showAdminBadge = isExplicitAdmin || isSelfAndStudyAdmin;

                                                return (
                                                    <div key={member.id} className="flex items-center justify-between group">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                                {member.name ? (
                                                                    <span className="text-xs font-bold text-gray-600">
                                                                        {member.name.charAt(0).toUpperCase()}
                                                                    </span>
                                                                ) : (
                                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-800">
                                                                    {showAdminBadge ? (
                                                                        member.name || member.email || member.invited_email
                                                                    ) : (
                                                                        member.email || member.invited_email
                                                                    )}
                                                                    {isSelf && <span className="text-gray-400 ml-1">(you)</span>}
                                                                </p>
                                                                {showAdminBadge && (
                                                                    <p className="text-xs text-gray-500">
                                                                        {member.email || member.invited_email}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center space-x-2">
                                                            {showAdminBadge ? (
                                                                <span className="text-xs font-medium text-gray-400 px-2 py-1 bg-gray-50 rounded italic">
                                                                    Admin
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <Select
                                                                        value={member.role}
                                                                        onValueChange={(val) => handleUpdateRole(member.id, val)}
                                                                        disabled={isActionLoading || userRole !== 'admin'}
                                                                    >
                                                                        <SelectTrigger className="h-8 border-transparent hover:bg-gray-100 transition-colors text-xs w-24">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="editor">Editor</SelectItem>
                                                                            <SelectItem value="viewer">Viewer</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    {userRole === 'admin' && (
                                                                        <button
                                                                            onClick={() => handleRemoveMember(member.id)}
                                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        {members.length === 0 && !isLoading && (
                                            <p className="text-sm text-gray-500 text-center py-4">
                                                No members added yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
                                <Button variant="outline" onClick={onClose} className="text-gray-600 border-gray-200">
                                    Done
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
