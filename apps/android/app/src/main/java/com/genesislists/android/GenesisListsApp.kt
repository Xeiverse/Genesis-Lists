package com.genesislists.android

import android.app.Application
import androidx.room.Room
import com.genesislists.android.data.AndroidConnectivityMonitor
import com.genesislists.android.data.ListsRepository
import com.genesislists.android.data.api.GenesisApiClient
import com.genesislists.android.data.db.GenesisDatabase
import com.genesislists.android.data.prefs.PersistentCookieJar
import com.genesislists.android.data.prefs.ServerSettingsStore

class GenesisListsApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

class AppContainer(app: Application) {
    private val settings = ServerSettingsStore(app)
    private val cookieJar = PersistentCookieJar.create(app)
    private val okHttp = GenesisApiClient.buildOkHttp(cookieJar)
    private val api = GenesisApiClient(baseUrlProvider = { settings.baseUrl }, client = okHttp)
    private val db = Room.databaseBuilder(app, GenesisDatabase::class.java, "genesis-lists.db")
        .fallbackToDestructiveMigration()
        .build()

    val repository = ListsRepository(
        api = api,
        dao = db.cacheDao(),
        settings = settings,
        cookieJar = cookieJar,
        connectivity = AndroidConnectivityMonitor(app),
    )
}
