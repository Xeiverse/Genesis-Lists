package uk.co.xeiverse.genesislists

import android.app.Application
import androidx.room.Room
import uk.co.xeiverse.genesislists.data.AndroidConnectivityMonitor
import uk.co.xeiverse.genesislists.data.ListsRepository
import uk.co.xeiverse.genesislists.data.api.GenesisApiClient
import uk.co.xeiverse.genesislists.data.db.GenesisDatabase
import uk.co.xeiverse.genesislists.data.prefs.PersistentCookieJar
import uk.co.xeiverse.genesislists.data.prefs.ServerSettingsStore

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
