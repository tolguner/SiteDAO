"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Vote, Menu, X, User, LogOut, ChevronDown, Shield, Key, Wallet, Sun, Moon, Bell, LogIn } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { GoogleLoginButton } from "@/components/ui/ZkLoginButton";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useCurrentAccount, useDisconnectWallet, useCurrentWallet } from "@mysten/dapp-kit";
import { isAdminEmail } from "@/lib/constants";
import { useSiteStore } from "@/lib/store";

const navLinks = [
  { href: "/", label: "Ana Sayfa", icon: Building2 },
  { href: "/rentals", label: "Kiralık", icon: Key },
  { href: "/sales", label: "Satılık Daireler", icon: Wallet },
  { href: "/dashboard", label: "Konutlarım", icon: LayoutDashboard },
  { href: "/governance", label: "Yönetim", icon: Vote },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const loginDropdownRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const {
    isConnected: zkLoginConnected,
    address: zkLoginAddress,
    email: zkLoginEmail,
    name: zkLoginName,
    givenName: zkLoginGivenName,
    familyName: zkLoginFamilyName,
    picture: zkLoginPicture,
    logout: zkLogout
  } = useZkLogin();
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();

  // Bağlı adres (zkLogin veya wallet)
  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;
  const isConnected = zkLoginConnected || !!account?.address;

  // Yönetici kontrolü
  const isAdmin = isAdminEmail(zkLoginEmail);

  // Bildirimler
  const notifications = useSiteStore((state) => state.notifications);
  const unreadCount = useSiteStore((state) => state.getUnreadNotificationCount)();
  const markNotificationAsRead = useSiteStore((state) => state.markNotificationAsRead);
  const markAllNotificationsAsRead = useSiteStore((state) => state.markAllNotificationsAsRead);
  const deleteNotification = useSiteStore((state) => state.deleteNotification);

  // Kullanıcı bilgileri
  // Önce store'daki profil adını kontrol et, yoksa zkLogin adı, en son cüzdan adresi
  const getUserProfile = useSiteStore((state) => state.getUserProfile);
  const userProfile = connectedAddress ? getUserProfile(connectedAddress) : undefined;

  const accountLabel = account?.label || (account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : null);

  // Öncelik: 1. Store'daki profil adı, 2. zkLogin Google adı, 3. Cüzdan etiketi
  const userName = userProfile?.displayName
    || (zkLoginConnected
      ? (zkLoginName || (zkLoginGivenName && zkLoginFamilyName ? `${zkLoginGivenName} ${zkLoginFamilyName}` : null))
      : accountLabel);
  const userPicture = userProfile?.avatarUrl || zkLoginPicture || null;

  // Çıkış yap fonksiyonu (hem zkLogin hem wallet için)
  const handleLogout = () => {
    if (zkLoginConnected) {
      zkLogout();
    } else if (account?.address) {
      disconnectWallet();
    }
    setProfileDropdownOpen(false);
  };

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationDropdownOpen(false);
      }
      if (loginDropdownRef.current && !loginDropdownRef.current.contains(event.target as Node)) {
        setLoginDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cüzdan bağlandığında login dropdown'ı kapat
  useEffect(() => {
    if (isConnected) {
      setLoginDropdownOpen(false);
    }
  }, [isConnected]);

  // Hydration için mounted kontrolü
  useEffect(() => {
    setMounted(true);
  }, []);

  // Adresi kısalt
  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - SiteDAO Hakkında Sayfasına Yönlendir */}
          <Link href="/about" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 rounded-lg gradient-sui flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline">SiteDAO</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}


          </div>

          {/* Connect Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title={resolvedTheme === 'dark' ? 'Aydınlık Tema' : 'Karanlık Tema'}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
            )}

            {/* Bildirimler - Sadece giriş yapmış kullanıcılar için */}
            {isConnected && connectedAddress && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                  className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                  title="Bildirimler"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Bildirim Dropdown */}
                {notificationDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold">Bildirimler</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllNotificationsAsRead()}
                          className="text-xs text-primary hover:underline"
                        >
                          Tümünü okundu işaretle
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Henüz bildirim yok</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {notification.link ? (
                                  <Link
                                    href={notification.link}
                                    onClick={() => {
                                      markNotificationAsRead(notification.id);
                                      setNotificationDropdownOpen(false);
                                    }}
                                    className="block"
                                  >
                                    <p className="font-medium text-sm truncate">{notification.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                                  </Link>
                                ) : (
                                  <>
                                    <p className="font-medium text-sm truncate">{notification.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                                  </>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(notification.createdAt).toLocaleDateString('tr-TR', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Sil"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {notifications.length > 10 && (
                      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-xs text-muted-foreground">
                          +{notifications.length - 10} daha fazla bildirim
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bağlıysa profil menüsü göster */}
            {isConnected && connectedAddress ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
                >
                  {userPicture ? (
                    <img src={userPicture} alt="" className="w-6 h-6 rounded-full" />
                  ) : zkLoginConnected ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  ) : (
                    <Wallet className="w-5 h-5 text-green-600" />
                  )}
                  <span className="text-green-700 dark:text-green-300 font-medium hidden sm:inline">
                    {userName || shortenAddress(connectedAddress)}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-green-600 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Basit Dropdown Menü */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Profilim</span>
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                      >
                        <Shield className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium">Yönetici Paneli</span>
                      </Link>
                    )}
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-medium">Çıkış Yap</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="relative"
                ref={loginDropdownRef}
              >
                <button
                  onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Giriş Yap</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${loginDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Giriş Yöntemleri Dropdown */}
                {loginDropdownOpen && (
                  <div className="absolute right-0 top-full pt-2 z-[100]">
                    <div className="w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-center text-muted-foreground">Giriş Yöntemi Seçin</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {/* Google ile Giriş */}
                        <div onClick={() => setLoginDropdownOpen(false)}>
                          <GoogleLoginButton />
                        </div>

                        <div className="relative flex items-center justify-center my-2">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                          </div>
                          <span className="relative px-3 bg-white dark:bg-gray-800 text-xs text-muted-foreground">veya</span>
                        </div>

                        {/* Cüzdan ile Giriş */}
                        <ConnectButton onConnect={() => setLoginDropdownOpen(false)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}

            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
